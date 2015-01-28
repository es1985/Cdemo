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

  console.log('Connected to the database!');
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

io.on('connection', function(socket)
{
//  console.log('connection detected')
  socket.on('data', function(msg)
  {
    console.log('message: ' + msg);
    io.emit('data', msg);
    data = JSON.parse(msg)
    if (data.data_type == 'player')
    {
      console.log('')
      console.log('Player has connected to the website!')
    	console.log('Checking if player id',data.id,'exists in the database')
    	db.query('SELECT id FROM players where id = ?', [data.id],function(err,result) 
	   {
    	if (err)
    		{ console.log(err) }
    	else 
       { 
        	console.log('Printing results of the check',result);
    		if (result == '')
		    {  
    			console.log('Inserting player id (?)',data.id);
    			db.query('INSERT INTO players (id,email,name,first_name,gender,locale,age_range,picture) VALUES (?,?,?,?,?,?,?,?);',
 			    [data.id,data.email,data.name,data.first_name,data.gender,data.locale,JSON.stringify(data.age_range),JSON.stringify(data.picture)],
 			      function(err,data)
			     { 
       			  if (err) 
              {console.log(err)};    
			     })
		    console.log('Checking who has invited the new user')
        db.query('SELECT distinct invitor FROM invitations where invited = ?', [data.id],function(err,result) 
          {
            if (err)
              { console.log(err) }
            else 
             { 
//                console.log('Invitor ids are',result[0].invitor)
//                console.log('Invitor ids are',result[1].invitor);
                console.log('Result length is',result.length)
                for (i=0; i<result.length; i++)
                  {
                    console.log('Emiting first entry event to ivitor id',result[i].invitor)
                    jason = {player_first_entry:data.id,name:data.name,picture:data.picture}
                    io.emit(result[i].invitor,jason);
                  }
             }
          })      
        }
        else
        {
          console.log('Player found! Retrieving a list of his existing games.')
          db.query('SELECT game_id,game_start,cat_last_login,human_last_login FROM games where cat_id = ? or human_id = ?', [data.id,data.id],function(err,result) 
          {
            if (err)
              { console.log(err) }
            else 
             { 
                console.log('Game ids are',result);
                socket.emit(data.id,result);
             }
          })      
        }   
	     };
      })
     }
  });

  socket.on("invite",function(msg)
  {
    console.log('')
    console.log('Invitation data type detected! Adding to the database')
    console.log('message: ' + JSON.stringify(msg));
    console.log('Sender id is',msg.sender)
    console.log('Invited is',msg.to[0])
    console.log('Length of request is', msg.to.length)
    io.emit('invite', msg);
    for (i=0; i<msg.to.length; i++)
    {
      console.log('I is',i)
      console.log(msg.to[i])
      db.query('INSERT INTO invitations (invitation_id,invitor,invited,invitation_time,invitation_timestamp) VALUES (?,?,?,?,?);',
      [msg.request+'_'+ msg.to[i],msg.sender,msg.to[i],msg.date_time,msg.timestamp],
      function(err,data)
      { 
      if (err) 
      {console.log(err)};    
      })
    }
  })

	socket.on("join",function(data)
  {
        console.log('')
        console.log('Player joining a game detected!')
        console.log('Data type is',data.data_type)
        console.log(data)
//        console.log('Parsed data is',JSON.parse(data))

        if (data.data_type == 'game_enter')
          {
          console.log('Game enter data type detected!')
          console.log('Checking if game id',data.game_id,'exists in the database')
          db.query('SELECT game_id,human_last_login,cat_last_login,human_id,cat_id FROM games where game_id = ?', [data.game_id],function(err,result) 
           {
            if (err)
            {console.log(err) }
            else 
            { 
            console.log('Printing results of the check',result);
            if (result == '')
             { 
              console.log('Human id is',data.game_id.split('_')[0]) 
              console.log('Cat id is',data.game_id.split('_')[1])
              if (data.sent_by === 0)
              { 
              console.log('Inserting game id',data.game_id,'into the database');
              db.query('INSERT INTO games (game_id,human_id,cat_id,human_last_login) VALUES (?,?,?,?);',
              [data.game_id,data.game_id.split('_')[0],data.game_id.split('_')[1],data.date_time],
                function(err,data)
                { 
                if (err) 
                {console.log(err)};    
                }) 
              console.log('Sending the new JOIN json to both players')
              jason = {user_id:parseInt(data.game_id.split('_')[0]),game_id:data.game_id,game_status:'new',human_last_login:data.date_time,cat_last_login:null}
              io.emit(data.game_id.split('_')[0],jason)
              jason = {user_id:parseInt(data.game_id.split('_')[1]),game_id:data.game_id,game_status:'new',human_last_login:data.date_time,cat_last_login:null}
              io.emit(data.game_id.split('_')[1],jason)
              }  
              else 
              {
              console.log('Inserting game id',data.game_id,'into the database');
              db.query('INSERT INTO games (game_id,human_id,cat_id,cat_last_login) VALUES (?,?,?,?);',
              [data.game_id,data.game_id.split('_')[0],data.game_id.split('_')[1],data.date_time],
                function(err,data)
                { 
                if (err) 
                {console.log(err)};    
                })
              console.log('Sending the new JOIN json to both players')
              jason = {user_id:data.game_id.split('_')[0],game_id:data.game_id,game_status:'new',cat_last_login:data.date_time,human_last_login:null}
              io.emit(data.game_id.split('_')[0],jason)
              jason = {user_id:data.game_id.split('_')[1],game_id:data.game_id,game_status:'new',cat_last_login:data.date_time,human_last_login:null}
              io.emit(data.game_id.split('_')[1],jason)   
              }                          
            }
            else 
               { 
               var d= new Date()
               console.log('Game id found!')
               if (data.sent_by == 1)
                {
                console.log('Cat id last login is',result[0].cat_last_login)
                if (result[0].cat_last_login == null)
                {
                console.log('First cat login detected, emmiting game start JSON and updating the database') 
                current_emoticons = '{"emo-happy":1,"emo-mad":1,"emo-food":1,"emo-love":1,"emo-night":1,"emo-kania":1}'
                possible_emoticons = '{"emo-happy":1,"emo-love":1,"emo-dayan":1,"emo-hipster":1,"emo-kania":1,"emo-mad":1,"emo-night":1,"emo-pilot":1,"emo-worried":1,"emo-food":1,"emo-blue":1,"emo-froid":1,"emo-pig":1,"emo-angel":1,"emo-shark":1}'
                achievements_reached='{}';
                achievements_seen='{}';
                possible_achievements='{"food_once":1,"food_when_really_hungry":1,"slept_once":1,"scratched_once":1,"stopped_scratching_once":1,"revived_once":1}';                achieve_state=JSON.stringify({times_food:0,times_revived:0,times_died:0,times_scratched:0,times_stppped_scratching:0,times_ate_while_really_hungry:0,times_slept:0,time_played:0,time_not_dying:0,time_both_online:0,time_without_scratching:0,times_messaged:0,});              
                achieve_state=JSON.stringify({times_food:0,times_revived:0,times_died:0,times_scratched:0,times_stppped_scratching:0,times_ate_while_really_hungry:0,times_slept:0,time_played:0,time_not_dying:0,time_both_online:0,time_without_scratching:0,times_messaged:0,});              
                 db.query('UPDATE games set game_start = (?),cat_last_login = (?),last_activity = (?),score = (?),health = (?),level = (?),dead =(?),health_timer = (?),cat_sleep = (?),food_at_bowl = (?),normal_mode = (?),fish_there = (?),displayed_cat_stage = (?),scratch_mark = (?),animations = (?),cat_animation_loop = (?),health_proxy = (?), food_opened = (?), current_emoticons = (?),possible_emoticons_list = (?),level_modal_open = (?), head_clicked = (?), belly_clicked = (?), new_emoticon_pack = (?), scratching = (?),timeouts = (?),last_timestamp = (?), last_health_timestamp = (?),interval_for_scratching = (?), achievements_reached = (?), achievements_seen = (?), possible_achievements = (?), achieve_state = (?) where game_id = (?);',[data.date_time,data.date_time,data.date_time,0,100,1,0,100,0,0,1,0,'cat_stage',0,'cat_stage:cat_breathing,cat_hidden_stage:wanting_caress,cat_hidden_stage2:caressing_going_on','cat_breathing',100,0,current_emoticons,possible_emoticons,'level modal open',0,0,'new emoticon pack',0,'timeouts',d.getTime(),d.getTime(),7000,achievements_reached,achievements_seen,possible_achievements,achieve_state,result[0].game_id],   
                  function(err,data)
                  { 
                if (err) 
                {console.log(err)};    
                  })   
                jason = {initialize:1, game_id:result[0].game_id,game_state:{ game_start:data.date_time,cat_last_login:data.date_time,last_activity:data.date_time,score:0,health:100,level:1,dead:0,cat_sleep:0,food_at_bowl:0,normal_mode:1,fish_there:0,displayed_cat_stage:'displayed cat stage',scratch_mark:0,animations:'animations',cat_animation_loop:'cat_breathing',health_proxy:100, food_opened:0, current_emoticons:current_emoticons,possible_emoticons_list:possible_emoticons,level_modal_open:0, head_clicked:0, belly_clicked:0, scratching:0,timeouts:'timeouts',last_timestamp:d.getTime(),last_health_timestamp:d.getTime(),interval_for_scratching:7000},achievements_reached:achievements_reached,achievements_seen:achievements_seen,possible_achievements:possible_achievements,achieve_state:achieve_state}
                console.log ('Emiting intilisation jason',jason)
                socket.emit(result[0].game_id,jason)
                console.log('Emiting notification to the user')
                socket.emit('Game',data.game_id,'begun')
                console.log('human id is', result[0].human_id)
                console.log('game_id is',result[0].game_id)
                jason = {user_id:data.game_id.split('_')[0],game_id:data.game_id,game_status:'started'}
                io.emit(data.game_id.split('_')[0],jason)
                }
                else
                {  
                console.log('Game has not started yet, updating activity times')  
                db.query('UPDATE games set cat_last_login = (?), last_activity = (?) where game_id = (?);',[data.date_time,data.date_time,result[0].game_id],
                function(err,data)
                  { 
                if (err) 
                {console.log(err)};    
                  })
                }
               } 
               else
                {
                console.log('Human id last login',result[0].human_last_login)  
                if (result[0].human_last_login == null)
                {
                console.log('Human first login detected, emitting game start JSON and updating the database')
                current_emoticons = '{"emo-happy":1,"emo-mad":1,"emo-food":1,"emo-love":1,"emo-night":1,"emo-kania":1}'
                possible_emoticons = '{"emo-happy":1,"emo-love":1,"emo-dayan":1,"emo-hipster":1,"emo-kania":1,"emo-mad":1,"emo-night":1,"emo-pilot":1,"emo-worried":1,"emo-food":1,"emo-blue":1,"emo-froid":1,"emo-pig":1,"emo-angel":1,"emo-shark":1}'
                achievements_reached='{}';
                achievements_seen='{}';
                possible_achievements='{"food_once":1,"food_when_really_hungry":1,"slept_once":1,"scratched_once":1,"stopped_scratching_once":1,"revived_once":1}';                achieve_state=JSON.stringify({times_food:0,times_revived:0,times_died:0,times_scratched:0,times_stppped_scratching:0,times_ate_while_really_hungry:0,times_slept:0,time_played:0,time_not_dying:0,time_both_online:0,time_without_scratching:0,times_messaged:0,});              
                achieve_state=JSON.stringify({times_food:0,times_revived:0,times_died:0,times_scratched:0,times_stppped_scratching:0,times_ate_while_really_hungry:0,times_slept:0,time_played:0,time_not_dying:0,time_both_online:0,time_without_scratching:0,times_messaged:0,});              
                db.query('UPDATE games set game_start = (?),human_last_login = (?),last_activity = (?),score = (?),health = (?),level = (?),dead =(?),health_timer = (?),cat_sleep = (?),food_at_bowl = (?),normal_mode = (?),fish_there = (?),displayed_cat_stage = (?),scratch_mark = (?),animations = (?),cat_animation_loop = (?),health_proxy = (?), food_opened = (?), current_emoticons = (?),possible_emoticons_list = (?),level_modal_open = (?), head_clicked = (?), belly_clicked = (?), new_emoticon_pack = (?), scratching = (?),timeouts = (?),last_timestamp = (?), last_health_timestamp = (?),interval_for_scratching = (?), achievements_reached = (?), achievements_seen = (?), possible_achievements = (?), achieve_state = (?) where game_id = (?);',[data.date_time,data.date_time,data.date_time,0,100,1,0,100,0,0,1,0,'cat_stage',0,'cat_stage:cat_breathing,cat_hidden_stage:wanting_caress,cat_hidden_stage2:caressing_going_on','cat_breathing',100,0,current_emoticons,possible_emoticons,'level modal open',0,0,'new emoticon pack',0,'timeouts',d.getTime(),d.getTime(),7000,achievements_reached,achievements_seen,possible_achievements,achieve_state,result[0].game_id],   
                function(err,data)
                  { 
                if (err) 
                {console.log(err)};    
                  })   
                jason = {initialize:1, game_id:result[0].game_id,game_state:{ game_start:data.date_time,cat_last_login:data.date_time,last_activity:data.date_time,score:0,health:100,level:1,dead:0,cat_sleep:0,food_at_bowl:0,normal_mode:1,fish_there:0,displayed_cat_stage:'cat_stage',scratch_mark:0,animations:'animations',cat_animation_loop:'cat_breathing',health_proxy:100, food_opened:0, current_emoticons:current_emoticons,possible_emoticons_list:possible_emoticons,level_modal_open:0, head_clicked:0, belly_clicked:0, scratching:0,timeouts:'timeouts',last_timestamp:d.getTime(),last_health_timestamp:d.getTime(),interval_for_scratching:7000},achievements_reached:achievements_reached,achievements_seen:achievements_seen,possible_achievements:possible_achievements,achieve_state:achieve_state}
                console.log ('Emiting intilisation jason',jason)
                socket.emit(result[0].game_id,jason)
                console.log('Emiting notification to the user')
                socket.emit('Game',data.game_id,'begun')
                console.log('cat id is', result[0].cat_id)
                console.log('game_id is',result[0].game_id)
                jason = {user_id:data.game_id.split('_')[1],game_id:data.game_id,game_status:'started'}
                io.emit(data.game_id.split('_')[1],jason)
                }
                else
                {
                console.log('Game has not started yet, updating activity times')
                db.query('UPDATE games set human_last_login = (?), last_activity = (?) where game_id = (?);',[data.date_time,data.date_time,result[0].game_id],
                function(err,data)
                  { 
                if (err) 
                {console.log(err)};    
                  })   
                }
                }  
               }
              
             };
           })
          }
          if (data.data_type == 'game_init')
          {
            var chat_history;
            console.log('')
            console.log('Sending game stats for game',data.game_id)
            db.query('SELECT * FROM games where game_id = ?', [data.game_id],
            function(err,result) 
            {
              if (err)
              {console.log(err) }
              else 
              { 
              console.log('Game details retrieved!')
              console.log('Retrieveing chat history!')
              db.query('SELECT json_id,json_content,json_content_type,json_datetime,json_timestamp,json_sender,message_seen FROM jsons where game_id = (?) and json_type = (?) ORDER BY json_datetime DESC limit 30;',[data.game_id,'chat_message'],
              function(err,history) 
              {
              if (err)
              {console.log(err) }
              else
              { 
//              console.log('Chat history is',history)
              jason = {initialize:1, game_id:result[0].game_id,chat_history:history,achieve_state:result[0].achieve_state,possible_achievements:result[0].possible_achievements,achievements_reached:result[0].achievements_reached,achievements_seen:result[0].achievements_seen,game_state:{game_start:result[0].game_start,human_last_login:result[0].date_time,last_activity:result[0].date_time,score:result[0].score,health:result[0].health,level:result[0].level,dead:result[0].dead,cat_sleep:result[0].cat_sleep,food_at_bowl:result[0].food_at_bowl,normal_mode:result[0].normal_mode,fish_there:result[0].fish_there,displayed_cat_stage:result[0].displayed_cat_stage,scratch_mark:result[0].scratch_mark,animations:result[0].animations,cat_animation_loop:result[0].cat_animation_loop,health_proxy:result[0].health_proxy, food_opened:result[0].food_opened, current_emoticons:result[0].current_emoticons,possible_emoticons_list:result[0].possible_emoticons_list, head_clicked:result[0].head_clicked, belly_clicked:result[0].belly_clicked, scratching:result[0].scratching,timeouts:result[0].timeouts,last_timestamp:result[0].last_timestamp, last_health_timestamp:result[0].last_health_timestamp,interval_for_scratching:result[0].interval_for_scratching},possible_achievements:result[0].possible_achievements,achievements_reached:result[0].achievements_reached,achievements_seen:result[0].achievements_seen,achieve_state:result[0].achieve_state}
              console.log('Sending JSON')
              console.log('Init json is',jason)
              socket.emit(data.game_id,jason)                    
              }
              })
              }
            })
            socket.on(data.game_id, function(data)
            {
              io.emit(data.game_id,data)
              console.log(data);
              if (data.data_type == 'game')
              {
                console.log('')
                console.log('Game data type detected')
                console.log(data)
                console.log('Updating database with the current game stats')
                if (data.sent_by == 0)
                {
                console.log('')  
                console.log('Human sending game stats,updating DB!')
                db.query('UPDATE games set human_last_login = (?),last_activity = (?),score = (?),health = (?),level = (?),dead =(?),cat_sleep = (?),food_at_bowl = (?),normal_mode = (?),fish_there = (?),displayed_cat_stage = (?),scratch_mark = (?),animations = (?),cat_animation_loop = (?),health_proxy = (?), food_opened = (?), current_emoticons = (?),possible_emoticons_list = (?), head_clicked = (?), belly_clicked = (?), scratching = (?),timeouts = (?),last_timestamp = (?), last_health_timestamp = (?),interval_for_scratching = (?), achieve_state = (?), possible_achievements = (?), achievements_reached = (?), achievements_seen =(?) where game_id = (?);',[data.date_time,data.date_time,data.game_state.score,data.game_state.health,data.game_state.level,data.game_state.dead,data.game_state.cat_sleep,data.game_state.food_at_bowl,data.game_state.normal_mode, data.game_state.fish_there,data.game_state.displayed_cat_stage,data.game_state.scratch_mark,'data.game_state.animations',data.game_state.cat_animation_loop,data.game_state.health_proxy,data.game_state.food_opened,data.game_state.current_emoticons, data.game_state.possible_emoticons_list,data.game_state.head_clicked,data.game_state.belly_clicked,data.game_state.scratching,data.game_state.timeouts,data.timestamp, data.game_state.last_health_timestamp,data.game_state.interval_for_scratching, data.achieve_state, data.possible_achievements, data.achievements_reached, data.achievements_seen, data.game_id],
                function(err,data)
                  { 
                  if (err) 
                  {console.log(err)};    
                  })    
                }
                if (data.sent_by == 1)
                {
                console.log('')
                console.log('Cat sending game stats,updating DB')
                db.query('UPDATE games set cat_last_login = (?),last_activity = (?),score = (?),health = (?),level = (?),dead =(?),cat_sleep = (?),food_at_bowl = (?),normal_mode = (?),fish_there = (?),displayed_cat_stage = (?),scratch_mark = (?),animations = (?),cat_animation_loop = (?),health_proxy = (?), food_opened = (?), current_emoticons = (?),possible_emoticons_list = (?), head_clicked = (?), belly_clicked = (?), scratching = (?),timeouts = (?),last_timestamp = (?), last_health_timestamp = (?),interval_for_scratching = (?), achieve_state = (?), possible_achievements = (?), achievements_reached = (?), achievements_seen =(?) where game_id = (?);',[data.date_time,data.date_time,data.game_state.score,data.game_state.health,data.game_state.level,data.game_state.dead,data.game_state.cat_sleep,data.game_state.food_at_bowl,data.game_state.normal_mode, data.game_state.fish_there,data.game_state.displayed_cat_stage,data.game_state.scratch_mark,data.game_state.animations,data.game_state.cat_animation_loop,data.game_state.health_proxy,data.game_state.food_opened,data.game_state.current_emoticons, data.game_state.possible_emoticons_list,data.game_state.head_clicked,data.game_state.belly_clicked,data.game_state.scratching,data.game_state.timeouts,data.timestamp, data.game_state.last_health_timestamp,data.game_state.interval_for_scratching, data.achieve_state, data.possible_achievements, data.achievements_reached, data.achievements_seen, data.game_id],
                function(err,data)
                  { 
                  if (err) 
                  {console.log(err)};    
                  })    
                }
                console.log('JSON id is',data.id)
                console.log('Inserting JSON',data.id,'into the database')
                console.log('JSON sender is',data.actions.sender)
                db.query('INSERT INTO jsons (json_id,game_id,json_type,json_timestamp,json_datetime,json_content,json_content_type,json_sender,message_seen) VALUES(?,?,?,?,?,?,?,?,?);',[data.id,data.game_id,data.data_type,data.timestamp,data.date_time,JSON.stringify(data.game_state),'data',data.actions.sender,1],
                function(err,data)
                  { 
                  if (err) 
                  {console.log(err)};    
                  })    
              }
              if (data.data_type == 'chat_message')
              {
                console.log('')
                console.log('Chat_message data type detected')
                console.log(data)
                console.log('JSON id is',data.id)
                console.log('Inserting JSON',data.id,'into the database')
                if (data.actions.emoticon === undefined)
                  {
                   content = data.actions.text
                   type = 'text'
                   console.log('Text chat detected. Adding 1 to the game score')
                   db.query('UPDATE games set score = score + (?) where game_id = (?);',[1,data.game_id],
                    function(err,data)
                    {
                      if (err)
                        {console.log(err)}
                    })
                  }
                if (data.actions.text === undefined)
                  {
                   content= data.actions.emoticon
                   type = 'emoticon'
                   db.query('UPDATE games set score = score + (?) where game_id = (?);',[2,data.game_id],
                    function(err,data)
                    {
                      if (err)
                        {console.log(err)}
                    })
                  }   
                db.query('INSERT INTO jsons (json_id,game_id,json_type,json_timestamp,json_datetime,json_content,json_content_type,json_sender,message_seen) VALUES(?,?,?,?,?,?,?,?,?);',[data.id,data.game_id,data.data_type,data.timestamp,data.date_time,content,type,data.actions.sender,0],
                function(err,data)
                  { 
                  if (err) 
                  {console.log(err)};    
                  })    
              }
              if (data.data_type == 'chat_ack')
              {
                console.log('')
                console.log('Chat seen message type detected')
                db.query('UPDATE jsons set message_seen = (?) where game_id = (?) and message_seen = (?);',[1,data.game_id,0],
                function(err,data)
                {
                  if (err)
                    {console.log(err)}
                })
              }                           
            })
      socket.on("disconnect", function() 
      {
      console.log(data)
      console.log('Disconnect by user',data.game_id,'event detected!')
      })                                 
    }  			
	});
});
 
server.listen(3020);
console.log('listening on *:3020');
