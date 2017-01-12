var io = require('socket.io-client');
var path = require('path');
var promise = require('bluebird');
var recursive = require('recursive-readdir');
var mkdirp = require('mkdirp');
var md5 = require('md5-file');
var junk = require('junk');
var fs = require('fs');
var logging = require('../logger');

//Data directory
var data_dir_default = path.join(__dirname, './data');
var data_dir = (process.env.DATA_DIR, data_dir_default);

//Promisifying functions
promise.promisifyAll(fs);
var recursiveAsync = promise.promisify(recursive);
var mkdirpAsync = promise.promisify(mkdirp);
var md5Async = promise.promisify(md5);

var connection = undefined;

//Connecting to server
connectServer();

//send user name and pair to the server.
connection.on('restart', function(){
	connectServer();
});



//send the files required by the pair
connection.on('sendFile', function(keys){
	var gen = sendFile.bind(null, keys);

	promise.coroutine(gen)()
		.then(function(files){
			connection.emit('files', files);
		})
		.catch(function(error){
			logging.error('error', error.message)
		});

});

//Receive the files sent by the pair
connection.on('receive',function(files){
	logging.info('Received files from server');
	var gen = recieveFiles.bind(null, files);
	promise.coroutine(gen)()
		.then(promise.coroutine(getFilesInfo)().then(function(data){
			connection.emit('storeData', data);
		}))
		.catch(function(error){
			logging.error('ERROR', error.message);
			reconnect();// can send files again
		})

});

connection.on('complete', function(){
	logging.info('Sync done');
	connection.close();
});

connection.on('metaDataStored',function(msg){
	logging.info(msg);
});

connection.on('pairOnline', function(msg){
	logging.info(msg);
});

connection.on('offline', function(msg){
	logging.info(msg);
});

connection.on('error', function(error){
	logging.error(error);
});


//Reconnect in case of error
function reconnect(){
	connection.close();
	connectServer();
}
//Function to connect to server
function connectServer(){
	connection = io.connect('http://localhost:9000');

	connection.emit('addUser', process.env.USER);
	connection.emit('pair', process.env.PAIR);

	promise.coroutine(getFilesInfo)()
		.then(function(data){
			connection.emit('storeData', data);
		})
		.catch(function(error){
			logging.error('ERROR', error.message);
			setTimeout(2000,connectServer());
		});
}


//Fetch the last modified and the md5 of all the files in the data folder
function *getFilesInfo(){
	if(!data_dir){
		var err = new Error('No data exists');
		return err;
	}

	logging.info({DIRNAME : data_dir});

	var files = yield recursiveAsync.call(null, data_dir);
	var keys = files.map(function(file){
		return file.split('/').pop();
	});

	var filteredList = keys.filter(junk.not);


	files = files.filter(function (fileName) {
		var absoluteName = fileName.split('/').pop();
		return filteredList.indexOf(absoluteName)>=0;
	});

	var filesPath = files.map(function(file){
		return file.slice(data_dir.length);
	});
	
	var infoObj = yield promise.all(files.map(function(obj){
		return fs.statAsync.call(null, obj);
	}));
	var md5Files = yield promise.all(files.map(function (obj) {
		return md5Async.call(null, obj);
	}));
	var data = {};
	for(var i = 0; i < files.length; ++i) {
		var payload = {};
		payload.last_modified = infoObj[i].mtime;
		payload.md5 = md5Files[i];
		data[filesPath[i]] = payload;
	}
	return JSON.stringify(data);
}

//Store the files received from the server in the directory
function *recieveFiles(files){
	for(var key in files){
		var filePath = key.split('/');
		var fileName = filePath.pop();

		filePath = filePath.join('/');

		if(filePath !== ''){
			filePath = path.join(data_dir, filePath);
			yield mkdirpAsync.call(null, filePath);
		}

		fileName = path.join(data_dir, key);

		yield fs.writeFileAsync.call(null, fileName, files[key]);
	}
}


//Send the files requested by the server that are requested by the pair
function *sendFile(keys){
	var filesPath = keys.map(function(key){
		return path.join(data_dir, key);
	});

	var files = {};
	for(var i = 0; i < filesPath.length; ++i){
		files[keys[i]] = fs.readFileSync(filesPath[i], 'utf-8');
	}
	return files;
}
