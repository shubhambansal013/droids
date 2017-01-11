var io = require('socket.io-client');
var path = require('path');
var promise = require('bluebird');
var recursive = require('recursive-readdir');
var mkdirp = require('mkdirp');

var fs = require('fs');
var logging = require('../logger');


var data_dir_default = path.join(__dirname, './data');

var data_dir = (process.env.DATA_DIR, data_dir_default);

promise.promisifyAll(fs);
var recursiveAsync = promise.promisify(recursive);
var mkdirpAsync = promise.promisify(mkdirp);

var connection = io.connect('http://localhost:9000');

// connection.emit('hi', {HEY : 'hello'});

var data = {};

connectServer();

//send user name and pair to the server.
connection.on('restart', function(){
	connectServer();
});

//send the files required by the pair
connection.on('sendFile', function(keys){
	var files = {};
	logging.info('keys', keys);
	for(var i = 0; i < keys.length; ++i){
		var filePath = path.join(data_dir, keys[i]);
		logging.info('file path', filePath);
		console.log(filePath);
		files[keys[i]] = fs.readFileSync.call(null, filePath, 'utf8');
	}
	logging.info('files sending', files);
	connection.emit('files', files);
});

//Receive the files sent by the pair
connection.on('receive',function(files){
	logging.info('Received files from server');

	promise.coroutine(function *(){
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
	})()
	.then(function(){
		console.log('Sync Done');
	connection.close();
	})
	.catch(function(error){
		logging.error('ERROR', error.message);
		connection.emit('storeData', data);;
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

function getFileInfo(cb){

	promise.coroutine(function *(){
		if(!data_dir){
			var err = new Error('No data exists');
			return err;
		}
		
		logging.info({DIRNAME : data_dir});
		
		var files = yield recursiveAsync.call(null, data_dir);
		var filesPath = files.map(function(file){
			return file.slice(data_dir.length);
		});
		logging.info('files', filesPath);
		// var filesPath = files.map(function(file){
		// 	return path.join(data_dir, file);
		// });
		for(var i = 0; i < files.length; ++i){
			var info = yield fs.statAsync.call(null, files[i]);
			// logging.info('info', info);
			logging.info('typeof', typeof(info.mtime));
			data[filesPath[i]] = info.mtime;
			logging.info('data', files[i], data[files[i]]);
		}
		return data;
	})()
		.then(function(data){
			logging.debug('DATA', data);
			return cb(null);
		})
		.catch(function(error){
			logging.error('ERROR', error.message);
			return cb(error);
		})

}

function connectServer(){
	connection.emit('addUser', process.env.USER);
	connection.emit('pair', process.env.PAIR);
	getFileInfo(function(error){
	if(error){
		return logging.error(error);
	}
	connection.emit('storeData', data);
});
}