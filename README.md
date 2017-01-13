# README.md

This node application is used for data synchronistation between two clients.
The clients have to connect to the server and specify their user name and the user name of their pair for communication.
The apps uses sockets.io for asynchronus communication.
The clients send the info of all the files in the data directory to the server.
Files info contains last modified date and the md5 hash.
The server compares the files info of both the client and the pair and request the specific user for the files required by their pair.
The users send the files requested by the server which are then send to their pairs.


### INSTALLATION

```ssh
$ npm install
$ mkdir logs
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

The default data folder should be created inside the client folder in case of using default directory name.

```ssh
$  USER=? PARI=? DATA_DIR=? node src/client/app2.js
```
