# README.md

This node application is used for data synchronistation between two clients.
The clients have to connect to the server and specify their user name and the user name of their pair for communication.
The apps uses sockets.io for asynchronus communication.


### INSTALLATION

```ssh
$ npm install
```

### SERVER

To start the server:

```ssh
$ node src/server/app2.js
```

### CLIENT

Node Process arguments
 - USER : Specify the unique username of the client.
 - PAIR : Specify the unique username of the client to pair with.
 - DATA_DIR (optional) : Specify the full path of the data directory containing the files to be synchronized.( default DATA_DIR='./data')

```ssh
$  USER=? PARI=? DATA_DIR=? node src/client/app2.js
```
