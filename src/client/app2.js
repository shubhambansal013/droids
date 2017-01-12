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

// connection.emit('hi', {HEY : 'hello'});

// var data = {};

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
			logging.info('files sending', files);
			connection.emit('files', files);
		})
		.catch(function(error){
			console.log('error', error)
		});

});

//Receive the files sent by the pair
connection.on('receive',function(files){
	logging.info('Received files from server');
	var gen = recieveFiles.bind(null, files);
	promise.coroutine(gen)()
		.then(promise.coroutine(getFilesInfo)().then(function(data){
			logging.info('***********DATA************123***', data);
			connection.emit('storeData', data);
		}))
		.catch(function(error){
			logging.error('ERROR', error.message);
			reconnect();// can send files again
		})

});

connection.on('complete', function(){
	console.log('Sync done');
	connection.close();
});

connection.on('metaDataStored', function(){
	logging.info('Meta data stored on server');
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
			logging.info('DATA', data);
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

	// console.log('hgeraesr', files.filter(junk.not));
	var filesPath = files.map(function(file){
		return file.slice(data_dir.length);
	});

	// logging.info('files', filesPath);

	var infoObj = yield promise.all(files.map(function(obj){
		return fs.statAsync.call(null, obj);
	}));
	var md5Files = yield promise.all(files.map(function (obj) {
		return md5Async.call(null, obj);
	}));
	var data = {};
	// logging.info('asdfasdfasd', md5Files);
	for(var i = 0; i < files.length; ++i) {
		var payload = {};
		payload.last_modified = infoObj[i].mtime;
		payload.md5 = md5Files[i];
		// console.log(payload);
		data[filesPath[i]] = payload;
		// console.log(filesPath[i]);
		// console.log('data', data);
	}
	return JSON.stringify(data);
}

//Store the files received from the server in the directory
function *recieveFiles(files){
	for(var key in files){
		logging.info('key', key);
		var filePath = key.split('/');
		var fileName = filePath.pop();

		filePath = filePath.join('/');
		logging.info('filepath', filePath);

		if(filePath !== ''){
			filePath = path.join(data_dir, filePath);
			yield mkdirpAsync.call(null, filePath);
		}

		fileName = path.join(data_dir, key);

		logging.info('Writing File :', key);
		logging.info('info', fileName, files[key]);
		yield fs.writeFileAsync.call(null, fileName, files[key]);
	}
}


//Send the files requested by the server that are requested by the pair
function *sendFile(keys){
	console.log("we are here eree");
	var filesPath = keys.map(function(key){
		return path.join(data_dir, key);
	});
	console.log('path', filesPath);

	var files = {};
	console.log(filesPath.length);
	for(var i = 0; i < filesPath.length; ++i){
		files[keys[i]] = fs.readFileSync(filesPath[i], 'utf-8');
	}
	// var data = yield promise.all(filesPath.map(function(file){
	// 	return fs.readFileAsync.call(null, file, 'utf-8');
	// }));
	// console.log("asdfasdf", data);
	// var files = {};
	// for(var i = 0; i < keys; ++i){
	// 	files[keys[i]] = data[i];
	// 	console.log(files);
	// }

	logging.info('files sending', files);
	return files;
}
