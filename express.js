var express = require('express');
var app = express();
var fs = require('fs');
var path = require('path')
var morgan = require('morgan');
var accessLogStream = fs.createWriteStream(path.join(__dirname, 'access.log'), {flags: 'a'})
var mysql = require('mysql');

var conn = mysql.createConnection({
	host: 'localhost',
        user: 'root',
        password: 'yourpasswd',
        port: '3306',
        database: 'yg', 
	multipleStatements: true
});


app.use(morgan('combined', {stream: accessLogStream}))

//api For playerinfo
app.get('/playerinfo.json',function(req,res){

         //Get userInfo and reutrn ( if session id not exist , reutrn error )	
	 const sqlStr = `select gender,playerId,organization,balance,applicableBonus,currency,homeCurrency,nickName,country from userinfo where \`key\` = ${req.query.sessiontoken}` ; 

	 conn.query(sqlStr,(err,results) => {

		if (err) { res.json({code: 1000,msg:'unknow sessiontoken'}) }

		else     { res.json ({ code: 0, data: results[0] }) }
	
		})
});	


//api For wager (bet)
app.get('/wager.json',function(req,res){
	
	//Insert wager orderId
	const wagerInsert = `insert into betlog set reference = "${req.query.reference}" , subreference = "${req.query.subreference}" , amount = "${req.query.amount}"`;

	//Insert wager orderId to cancellog
	const cancelInsert = `insert into cancellog set reference = "${req.query.reference}" , subreference = "${req.query.subreference}" , amount = "${req.query.amount}"`;

	//Update user balance
	const wagerUpdate = `update userinfo set balance = balance - ${req.query.amount} where \`key\` = ${req.query.sessiontoken} `;

	//Return user balance
	const wagerStr = `select organization,playerId,currency,applicableBonus,homeCurrency,balance,nickName,bonus from userinfo where \`key\` = ${req.query.sessiontoken}` ;

	//Ygg systemctl not allow amount too Big
	if (req.query.amount.length > 11) { res.json ({ code: 1006, msg:'expensive money' }) }

	//if amount not too Big
	else {

	 //Insert wager orderId
	 conn.query(wagerInsert,(err,results) => {

		// if orderId exist will trigger wagerInsert.err then return current user balance 
		if (err) { conn.query(wagerStr,(err,results) => { res.json ({ code:0, data:results[0] }) }) }

		// if orderId not exist wagerInsert.results will Insert orderId then update user balance and return current user balance
		else { 
			// insert wager orderId into cancellog
			conn.query(cancelInsert,(err,results) => { if (err) { console.log('wager.json cancelInsert Error'); } })

			// update user info
			conn.query(wagerUpdate,(err,results) => { if (err) { console.log('wager.json wagerUpdate Error'); } })

			// return user info
		        conn.query(wagerStr,(err,results) => { if (err) { console.log('wager.json wagerStr Error'); } else { res.json ({ code: 0,data: results[0]}				)}})
			
			}
		})
	}
})


//api For endwager
app.get('/endwager.json',function(req,res){

	//Insert endwager orderId to endwagerlog 
	const endwagerInsert = `insert into endwagerlog set reference = "${req.query.reference}" , subreference = "${req.query.subreference}" , amount = "${req.query.amount}"`;
        //Update user balance if endwager call
	const endwagerUpdate = `update userinfo set balance = balance + ${req.query.amount} where playerId = ${req.query.playerid} `;

	//get userinfo and balance return YG after endwager call
	const endwagerStr = `select organization,playerId,currency,homeCurrency,balance,nickName from userinfo where \`playerId\` = ${req.query.playerid}`
	
	//Insert endwager orderId
	conn.query(endwagerInsert,(err,results) => {

		//if endwager insert orderid.err (exsit) return user status
		if (err) { conn.query(endwagerStr,(err,results) => { res.json ({ code:0, data:results[0] }) }) }
		
		// if endwager insert not err , update user balnace 
		else { 
		conn.query(endwagerUpdate,(err,results) => { if (err) { console.log('Endwager.json endwagerUpdate Error') } })
	
		// and return user status
		conn.query(endwagerStr,(err,results) => { if (err) { console.log('Endwager.json endwagerStr Error') }

		res.json ({ code: 0, data: results[0] })

       	 	}) }}) });

//api For cancelwager
app.get('/cancelwager.json',function(req,res){

	//if cancel call Get cancellog.reference and update user balance 
	const cancelwagerUpdate = `UPDATE userinfo SET balance = balance + (SELECT amount FROM cancellog WHERE reference = "${req.query.reference}") WHERE playerId = ${req.query.playerid}`

	//select reference id
	const cancelwagerSelect = `select reference from cancellog where reference = "${req.query.reference}"`

	//delete cancel orderId.
	const cancelwagerDelete = `DELETE FROM cancellog WHERE reference = "${req.query.reference}"`

	//get userinfo return YG
	const cancelwagerStr = `select organization,playerId,currency,balance,bonus from userinfo where \`playerId\` = ${req.query.playerid}`

	//if cancellog.reference have value
	if (cancelwagerSelect) { 
			
			//give user amount (update) if no value will trigger err
			conn.query(cancelwagerUpdate,(err,results) => { if (err) { console.log('cancelwager.json cancelwagerUpdate Error(But its ok)') } })

			//and delete cancellog id
			conn.query(cancelwagerDelete,(err,results) => { if (err) { console.log('cancelwager.json cancelwagerDelete Error') } })

			//return user status
			conn.query(cancelwagerStr,(err,results) => { if (err) { console.log('cancelwager.json cancelwagerStr Error') } 
			
			res.json({ code:0, data:results[0] })
			}) } });

//api For getbalance
app.get('/getbalance.json',function(req,res){
	
	//Get user info and reutrn ( if session id not exist , reutrn error )	
	const getbalancesqlStr = `select organization,playerId,currency,homeCurrency,applicableBonus,balance,nickName,bonus from userinfo where \`key\` = ${req.query.sessiontoken}` ; 
	
		conn.query(getbalancesqlStr,(err,results) => { if(err) { console.log('getbalance.json getbalanceStr Error') }

		else { res.json({ code: 0, data: results[0] }) } }) });

//api For appendwagerresult
app.get('/appendwagerresult.json',function(req,res){

	//append user balance 
	const appendwagerUpdate = `update userinfo set balance = balance + ${req.query.amount} where playerId = ${req.query.playerid}`

	//Get user info and return
	const appendwagerStr = `select organization,playerId,currency,homeCurrency,applicableBonus,balance,nickName,bonus from userinfo where playerId = ${req.query.playerid}` ;
	
	//Select append log about reference
	const appendwagerSelect = `select reference from appendlog where reference = "${req.query.reference}"`

	//insert append log
	const appendInsert = `insert into appendlog set reference = "${req.query.reference}" , subreference = "${req.query.subreference}" , amount = "${req.query.amount}"`;

		//insert order id 
		conn.query(appendInsert,(err,results) => {
			
			// if oderid exist reutrn current user info
			if(err) { conn.query(appendwagerStr,(err,results) => { res.json ({ code:0, data:results[0] }) }) }

			// if orderId not exist , update user balance and return current user balanc
			else {
				//append user amount
				conn.query(appendwagerUpdate,(err,results) => { if (err) { console.log('appendwager.json appendwagerUpdate Error') } })

				//return user status
				conn.query(appendwagerStr,(err,results) => { if (err) { console.log('appendwager.json appendwagerStr Error') } 
				
               		        res.json ({ code: 0, data: results[0] }) }) } }) })


app.listen(3000,function(){
	console.log('http://IP:PORT/');
});	
	
