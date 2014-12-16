var app = require('express')();
var https = require('https');
var http = require('http');
var fs = require('fs');
var path = require('path');
var mysql = require('mysql');

//connect to mysql database
var db = mysql.createConnection({
      host: 'localhost'
    , database: 'catpips'
    , user: 'root'
    , password: 'Mil@n2014'});

db.connect(function(err){
    if (err) console.log(err)
})


db.query('SELECT 1 + 1 AS solution', function(err, rows, fields) {
  if (err) throw err;

  console.log('The solution is: ', rows[0].solution);
});

//configure keys for ssl communication
var privateKey = fs.readFileSync('/home/ssl/server.key').toString();
var certificate = fs.readFileSync('/home/ssl/server.crt').toString();
//create https server using the keys
var server = https.createServer({key:privateKey,cert:certificate},app);

var io = require('socket.io').listen(server);

var express=require('express');
app.use(express.static(__dirname + '/Demo'));


app.get('/', function (req, res) {
res.sendFile('/desktop-wrapper/index.html/');
  //res.sendfile(__dirname + '/index.html');
});

io.on('connection', function(socket){

  console.log('user connected')

  socket.on('data', function(msg){
    console.log('message: ' + msg);
    io.emit('data', msg);
    data = JSON.parse(msg)
    if (data.data_type == 'player')
    {
    	console.log('Checking if player id',data.id,'exists in the database')
    	db.query('SELECT id FROM players where id = ?', [data.id],function(err,result) 
	{
    	if (err)
    		{ console.log(err) }
    	else { 
        	console.log('Printing results of the check',result);
    		if (result == '')
		{  
    			console.log('Inserting player id (?)',data.id);
    			db.query('INSERT INTO players (id,email,name,first_name,gender,age_range,picture) VALUES (?,?,?,?,?,?,?);',
 			[data.id,data.email,data.name,data.first_name,data.gender,JSON.stringify(data.age_range),JSON.stringify(data.picture)],
 			function(err,data)
			{ 
       			if (err) throw err;    
			})
		}
	    };
        })
    }
});
	socket.on("join",function(msg){
		   socket.on(msg, function(msgg){
    			console.log('message: game '+msg+' - ' + msgg);
    		io.emit(msg, msgg);
 			 });
	});

});

server.listen(3020);
console.log('listening on *:3020');
