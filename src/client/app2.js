var io = require('socket.io-client');
var path = require('path');
var md5 = require('md5-file');
var promise = require('bluebird');
var fs = require('fs');
var logging = require('../logger');

var data_dir = path.join(__dirname, './data');

promise.promisifyAll(fs);
// promise.promisify(mapd5);

var connection = io.connect('http://localhost:9000');

// connection.emit('hi', {HAHA : 'hahaha'});
var data = {};
function calculateHash(cb){
		promise.coroutine(function *(){
	  if(!data_dir){
	    var err = new Error('No data exists');
	    return err;
	  }
	  logging.info({DIRNAME : data_dir});
	    var files = yield fs.readdirAsync.call(null, data_dir);
	    var filesPath = files.map(function(file){
	    	return path.join(data_dir, file);
	    });
	    for(var i = 0; i < filesPath.length; ++i){
	    	var hash = yield promise.resolve(md5.sync(filesPath[i]));
	    	data[hash] = files[i];
	    }
	    return data;
	})()
	.then(function(data){
		logging.info({DATA : data});
		return cb(null);
	})
	.catch(function(error){
	  logging.error({ERROR : error.message});
	  return error;
	})
}


// connection.on('syncHash', function(data2){
// 	var missingKeys = [];
// 	for(var key in data2){
// 		// logging.info(data2[key]);
// 		if(!~data[key]){
// 			logging.info(key+" exists");
// 			missingKeys.push(key);
// 		}
// 	}
// 	connection.emit('getFile', key);
// 	connection.on('file', function(filesObj){
// 		for(var key in filesObj){
// 		logging.info(filesObj[key]);
// 			if(~filesObj[key]){
// 				// logging.info(filesObj[key]);
// 			}
// 		}
// 	});
// })

connection.emit('addUser', process.env.USER);
connection.emit('pair', process.env.PAIR);


calculateHash(function(error){
	if(error){
		return logging.error(error);
	}
	connection.emit('storeHash', data);
})





connection.on('sendFile', function(fileObj){
	var files = {};
	for(var key in fileObj){
		var filePath = path.join(data_dir, fileObj[key]);
		files[fileObj[key]] = fs.readFileSync(filePath, 'utf8'); 
	}
	connection.emmit('files', files);
});

connection.on('recieve', function(files){
	for(var key in files){
		var filePath = path.join(data_dir, key);
		fs.writeFileSync(filePath, files[key]);
	}
	calculateHash(function(){
		connection.emit('storeHash', data);
	});
})

connection.on('complete', function(){
	console.log('sync done');
	connection.close();
});

connection.on('hashStored', function(){
	logging.info('Hash stored on server');
});

connection.on('error', function(error){
	logging.error(error);
})