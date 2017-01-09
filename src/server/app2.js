var express = require('express');
var request = require('request');
var morgan = require('morgan');
var promise = require('bluebird');
var socket_io = require('socket.io');
var bodyParser = require('body-parser');

var logger = require('../logger');
var sync = require('./routes/sync');

var app = express();

// promise.promisifyAll(socket);

var port = process.env.PORT || 9000;
app.set('port', port)
app.use(morgan('dev'));
app.use(bodyParser.json({limit : '200mb'}));
app.use(bodyParser.urlencoded({limit : '20mb', extended : true}));
app.use(function (req, res, next){
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.get('/hello', (req, res) => {
  logger.info('GET : hello');
  return res.send('whatup');
});


var listener = app.listen(port, () => {
	console.log("Express is listening on port" );
});

var io = socket_io.listen(listener);



var users = {}; //Object storing the userName : socket.id of users connected
var hash = {}; // Object storing the userName : { md5 : fileName, ...}

io.on('connection', function(socket){
	promise.promisifyAll(socket);
	
	console.log(socket.id + ' just connected');
	
	socket.on('hi', function(data){
		console.log(data);
	});

	//Add User to user object
	socket.on('addUser', function(user){
		logger.info('added user');
		socket.user = user;
		users[user] = socket.id;
	});

	//Add pair to socket object
	socket.on('pair', function(pair){
		logger.info('added pair');
		socket.pair = pair;
	});

	//Store MD5 of file of user to hash object
	socket.on('storeHash', function(data){
		hash[socket.user] = data;
		logger.info({FILES : hash[socket.user]}, {USER : socket.user}, {PAIR : socket.pair});
		socket.emit('hashStored');
		try{
			logger.info('data', {'DATA' : hash});

			//Check if pair is online
			if(!socket.pair){
				var err = new Error('No pair info found');
				// logger.error({ERROR : err.message});
				throw err;
			}
			logger.info('users', users);
			
			//Emit event to clients about online info.
			io.to(users[socket.user]).emit('pairOnline', socket.pair+' is Online.');
			io.to(users[socket.pair]).emit('pairOnline', socket.user+' is Online.');
			
			if(users[socket.pair]){
				logger.info('Checking files to transfer');
				var filesUser = {};
				var filesPair = {};
				
				//Add the files to be transfered to pair in filesUser
				for(var key in hash[socket.pair]){
					if(!hash[socket.user][key]){
						filesUser[key] = hash[socket.pair][key]
					}
				}
				
				//Add the files to be transfered to user in filesPair
				for(var key in hash[socket.user]){
					if(!hash[socket.pair][key]){
						filesPair[key] = hash[socket.user][key]
					}
				}
				logger.info('To_User', filesUser);
				logger.info('To_Pair', filesPair);
				if(!filesUser.length && !filesPair.length){
					logger.info('sending complete event');
					//Emit complete event in case of files sent to be sent 
					io.to(users[socket.user]).emit('complete');
					io.to(users[socket.pair]).emit('complete');
				}
				else{
					//Request users for files that their pair dont have
					logger.info('Requesting files from clients');
					if(Object.keys(filesUser).length)
						io.to(users[socket.user]).emit('sendFile', filesUser);

					if(Object.keys(filesPair).length)
						io.to(users[socket.pair]).emit('sendFile', filesPair);
				}
				
			}
			else{
				throw new Error('Pair not connected');
			}
		}
		catch(error){
			logger.error('Error', error.message);
			socket.emit('error', error.message);
		}
	});
	//Send files received from users to their pairs
	socket.on('files', function(files){
		io.to(users[socket.pair]).emit('receive', files);
	});

	socket.on('disconnect', function(){
		console.log(socket.id + " just disconnected");
		delete users[socket.user];
		delete hash[socket.user];
	});
});

