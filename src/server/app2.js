var express = require('express');
var request = require('request');
var morgan = require('morgan');
var promise = require('bluebird');
var socket_io = require('socket.io');
var bodyParser = require('body-parser');

var logging = require('../logger');

var app = express();

//Server is running on port 9000 by default
var port = process.env.PORT || 9000;
app.set('port', port)
app.use(morgan('dev'));

var listener = app.listen(port, () => {
	console.log("Express is listening on port" );
});

var io = socket_io.listen(listener);

var users = {}; //Object storing the userName : socket.id of users connected
var userFiles = {}; // Object storing the userName : { fileName : last_modified_time, ...}

io.on('connection', function(socket){
	promise.promisifyAll(socket);
	
	console.log(socket.id + ' just connected');

	//Fetch all info from client in case of server restart
	io.emit('restart', null);

	//Testing function
	socket.on('hi', function(data){
		console.log(data);
	});

	//Add User to user object
	socket.on('addUser', function(user){
		logging.info('added user');
		socket.user = user;
		users[user] = socket.id;
	});

	//Add pair to socket object
	socket.on('pair', function(pair){
		logging.info('added pair');
		socket.pair = pair;
	});

	//store file data in userFiles
	socket.on('storeData', function(data){
		userFiles[socket.user] = data;
		// logging.info({FILES : userFiles})
		
		//Send the client that data has been stored on server.
		socket.emit('metaDataStored');
		try{
			//Check if pair is online
			if(!socket.pair){
				var err = new Error('No pair info found');
				// logging.error({ERROR : err.message});
				throw err;
			}			

			if(users[socket.pair]){

				//Emit event to clients about online info.
				io.to(users[socket.user]).emit('pairOnline', socket.pair+' is Online.');
				io.to(users[socket.pair]).emit('pairOnline', socket.user+' is Online.');
				
				logging.info('Checking files to transfer');
				var getFromUser = [];
				var getFromPair = [];
				
				//Add the files to be transfered to pair in filesUser
				for(var key in userFiles[socket.pair]){
					// check if file does not exists with user
					if(!userFiles[socket.user][key]){
						getFromPair.push(key);
					}
					// check if the file has been modified by the pair lately
					else if(userFiles[socket.user][key] < userFiles[socket.pair][key]){
						getFromPair.push(key);
					}
				}
				
				//Add the files to be transfered to user in filesPair
				for(var key in userFiles[socket.user]){
					// check if file does not exists with pair
					if(!userFiles[socket.pair][key]){
						getFromUser.push(key);
					}
					// check if the file has been modified by the user lately
					else if(userFiles[socket.pair][key] < userFiles[socket.user][key]){
						getFromUser.push(key);
					}
				}
				// logging.info('Get From User', getFromUser);
				// logging.info('Get From Pair', getFromPair);

				if(!getFromUser.length && !getFromPair.length){
					logging.info('Sending complete event');
					//Emit complete event in case of files sent to be sent 
					io.to(users[socket.user]).emit('complete');
					io.to(users[socket.pair]).emit('complete');
				}
				else{
					//Request users for files that their pair dont have
					logging.info('Requesting files from clients');

					//Fetching files to be transfered to their pairs from users

					if(getFromUser.length)
						io.to(users[socket.user]).emit('sendFile', getFromUser);

					if(getFromPair.length)
						io.to(users[socket.pair]).emit('sendFile', getFromPair);
				}
				
			}
			else{
				socket.emit('offline', 'pair not connected');
			}
		}
		catch(error){
			logging.error('Error', error.message);
			socket.emit('error', error.message);
		}
	});
	//Send files received from users to their pairs
	socket.on('files', function(files){
		io.to(users[socket.pair]).emit('receive', files);
	});

	socket.on('disconnect', function(){
		logging.info(socket.id + " just disconnected");
		delete users[socket.user];
		delete userFiles[socket.user];
	});
});

