'use strict'
var request = require('request');
var fs = require('fs');
var path = require('path');
var promise = require('bluebird');
promise.promisifyAll(fs);
var logging = require('../logger');
var data_dir = path.join(__dirname, '../data');

var url = 'http://localhost:9000/hello';
var options = {
		url: url,
		method: 'GET',
		headers: {
			'Content-Type': 'application/json; charset=utf-8'
		}
	};

promise.coroutine(function *(){
  if(!data_dir){
    var err = new Error('No data exists');
    return err;
  }
    var files = yield fs.readdirAsync.call(null, data_dir);
})()
.then(function(){
  logging.info({REPONSE : response});
  return;
})
.catch(function(){
  logging.error({ERROR : error.message});
  return;
})

request(options, function(error, body, response){
  if(error){
    logging.error({EVENT : 'requesting the server'}, {ERROR : error.message});
  }
  logging.info({REPONSE : response});
});
