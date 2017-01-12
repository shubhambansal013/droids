var express = require('express');
var request = require('request');
var morgan = require('morgan');
var promise = require('bluebird');
var socket_io = require('socket.io');

var logging = require('../logger');

var app = express();

//Server is running on port 9000 by default
var port = process.env.PORT || 9000;
app.set('port', port);
app.use(morgan('dev'));

var listener = app.listen(port, () => {
	console.log("Express is listening on port" );
});

var io = socket_io.listen(listener);

//Object storing the userName : socket.id of users connected
var users = {};
// Object storing the userName : { fileName : last_modified_time, ...}
var userFiles = {};

//Fetch all info from client in case of server restart
io.emit('restart');

//Event for connection with the clients
io.on('connection', function(socket){

	logging.info(socket.id + ' just connected');
	
	//Add User to user object
	socket.on('addUser', function(user){
		socket.user = user;
		users[user] = socket.id;
	});

	//Add pair to socket object
	socket.on('pair', function(pair){
		socket.pair = pair;
	});

	socket.on('storeData', function(data){
		//store file data in userFiles
		data = JSON.parse(data);
		userFiles[socket.user] = data || {};

		//Send the client that data has been stored on server.
		socket.emit('metaDataStored', 'Meta data stored on server');

		var gen = startSync.bind(null, io, socket, users, userFiles);

		promise.coroutine(gen)()
			.catch(function(error){
				emitErrorEvent(socket, error);
			})
	});
	
	//Send files received from users to their pairs
	socket.on('files', function(files){
		io.to(users[socket.pair]).emit('receive', files);
	});

	socket.on('disconnect', function(){
		if(users[socket.pair]){
			io.to(socket[socket.pair]).emit('offline', 'Pair has gone offline');
		}
		delete users[socket.user];
		delete userFiles[socket.user];
	});
});

// Perform the sync task
function *startSync(io, socket, users, userFiles){

	yield validatePairInfoAsync.call(null, socket);

	yield checkPairOnlineAsync.call(null, users, socket);

	yield emitOnlineStatusAsync.call(null, io,socket, users);

	var user = socket.user;
	var pair = socket.pair;

	// get the filpath inside the data directory that is required by their pairs
	var getFromUser = filesToFetch(userFiles, pair, user);
	var getFromPair = filesToFetch(userFiles, user, pair);
	
	// If no files are to be transferred emit sync complete event
	if(!getFromUser.length && !getFromPair.length){
		logging.info('Sending complete event');
		//Emit complete event in case of files sent to be sent 
		io.to(users[user]).emit('complete');
		io.to(users[pair]).emit('complete');
		return;
	}
	else{
		//Request users for files that their pair dont have
		logging.info('Requesting files from clients');

		//Fetching files to be transfered to their pairs from users
		if(getFromUser.length)
			io.to(users[user]).emit('sendFile', getFromUser);
		if(getFromPair.length)
			io.to(users[pair]).emit('sendFile', getFromPair);
	}
}

var checkPairOnlineAsync = promise.promisify(checkPairOnline);

//check if the pair in online
function checkPairOnline(users, socket, cb){
	if(!users[socket.pair]){
		var err = new Error('Pair offline');
		err.event = 'offline';
		return cb(err);
	}
	return cb();
}

var validatePairInfoAsync = promise.promisify(validatePairInfo);

// check if socket has the pair name
function validatePairInfo(socket, cb){
	if(!socket.pair) {
		var err = new Error('No pair info found');
		return cb(err);
	}
	return cb();
}

function emitErrorEvent(socket, error){
	if(!error.event){
		error.event = 'error';
	}
	if(!error.message){
		error.message = 'Something Went Wrong';
	}
	logging.error('error', error.message);
	socket.emit(error.event, error.message);
}

var emitOnlineStatusAsync = promise.promisify(emitOnlineStatus);

//Tell the pair that both are online
function emitOnlineStatus(io, socket, users, cb){

	//Emit event to clients about online info.
	io.to(users[socket.user]).emit('pairOnline', socket.pair+' is Online.');
	io.to(users[socket.pair]).emit('pairOnline', socket.user+' is Online.');

	cb();
}

function filesToFetch(userFiles, to, from){
	var files = [];
	for(var key in userFiles[from]){
		if(!userFiles[to][key]){
			files.push(key);
		}
		// check if the file has been modified by the pair lately
		else if(userFiles[to][key].md5 != userFiles[from][key].md5){
			if(userFiles[to][key].last_modified < userFiles[from][key].last_modified){
				files.push(key);
			}
		}
	}

	return files;
}