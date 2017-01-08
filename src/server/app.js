var express = require('express');
var request = require('request');
var morgan = require('morgan');
var socket_io = require('socket.io');
var bodyParser = require('body-parser');

var logger = require('../logger');
var sync = require('./routes/sync');
var app = express();

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
