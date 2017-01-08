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
})

app.get('/hello', (req, res) => {
  logger.info('GET : hello');
  return res.send('whatup');
});


var listener = app.listen(port, () => {
	console.log("Express is listening on port" )
});
var io = socket_io.listen(listener);

var users = {};
var hash = {};

io.on('connection', function(socket){
	promise.promisifyAll(socket);
	
	console.log(socket.id + ' just connected');
	
	socket.on('hi', function(data){
		console.log(data);
	});
	
	socket.on('addUser', function(user){
		logger.info('added user');
		socket.user = user;
		users[user] = socket.id;
	});
	socket.on('pair', function(pair){
		logger.info('added pair');
		socket.pair = pair;
	})
	socket.on('storeHash', function(data){
		hash[socket.user] = data;
		logger.info({FILES : hash[socket.user]}, {USER : socket.user}, {PAIR : socket.pair});
		socket.emit('hashStored');
		try{
			logger.info('data', {'DATA' : hash});
			if(!socket.pair){
				var err = new Error('No pair info found');
				// logger.error({ERROR : err.message});
				throw err;
			}
			logger.info('users', users);
			if(users[socket.pair]){
				logger.info('Checking files to transfer');
				var filesUser = {};
				var filesPair = {};
				for(var key in hash[socket.pair]){
					if(!~hash[socket.user][key]){
						filesUser[key] = hash[socket.pair][key]
					}
				}
				for(var key in hash[socket.user]){
					if(!~hash[socket.pair][key]){
						filesPair[key] = hash[socket.user][key]
					}
				}
				logger.info('To_User', filesUser);
				logger.info('To_Pair', filesPair);
				if(!filesUser.length && !filesPair.length){
					logger.info('sending complete event');
					io.to(users[socket.user]).emit('complete');
					io.to(users[socket.pair]).emit('complete');
				}
				else{
					logger.info('Requesting send files');
					io.to(users[socket.user]).emit('sendFile', filesUser);
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

	socket.on('files', function(files){
		io.sockets.in(socket.pair).emit('receive', files);
	});
	// promise.coroutine(function *(){
	// 	logger.info('syncing');
	// 	var data = yield socket.onAsync('checkHash');
	// 	hash[socket.user] = data;
	// 	io.emit('syncHash', data);
	// 	return promise.resolve(data);
	// })()
	// .then(function(data){
	// 	logger.info({DATA : data});
	// })
	// .catch(function(error){
	// 	logger.error({ERROR : error.message});
	// })
	
	socket.on('disconnect', function(){
		console.log(socket.id + " just disconnected");
		delete users[socket.user];
		delete hash[socket.user];
	});
})

function startSync(user, pair){

}