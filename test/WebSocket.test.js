var assert = require('assert')
  , WebSocket = require('../')
  , fs = require('fs')
  , server = require('./testserver');

var port = 20000;

function getArrayBuffer(buf) {
    var l = buf.length;
    var arrayBuf = new ArrayBuffer(l);
    for (var i = 0; i < l; ++i) {
        arrayBuf[i] = buf[i];
    }
    return arrayBuf;
}

function areArraysEqual(x, y) {
    if (x.length != y.length) return false;
    for (var i = 0, l = x.length; i < l; ++i) {
        if (x[i] !== y[i]) return false;
    }
    return true;
}

module.exports = {
    'throws exception for invalid url': function(done) {
        try {
            var ws = new WebSocket('echo.websocket.org');            
        }
        catch (e) {
            done();
        }
    },
    'text data can be sent and received': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.send('hi');
            });
            ws.on('message', function(message, flags) {
                assert.equal('hi', message);
                ws.terminate();
                srv.close();
                done();
            });
        });
    },
    'binary data can be sent and received as array': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var array = new Float32Array(5);
            for (var i = 0; i < array.length; ++i) array[i] = i / 2;
            ws.on('open', function() {
                ws.send(array, {binary: true});
            });
            ws.on('message', function(message, flags) {
                assert.ok(flags.binary);
                assert.ok(areArraysEqual(array, new Float32Array(getArrayBuffer(message))));
                ws.terminate();
                srv.close();
                done();
            });
        });
    },
    'binary data can be sent and received as buffer': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var buf = new Buffer('foobar');
            ws.on('open', function() {
                ws.send(buf, {binary: true});
            });
            ws.on('message', function(message, flags) {
                assert.ok(flags.binary);
                assert.ok(areArraysEqual(buf, message));
                ws.terminate();
                srv.close();
                done();
            });
        });
    },
    'can disconnect before connection is established': function(done) {
        var ws = new WebSocket('ws://echo.websocket.org');
        ws.terminate();
        ws.on('open', function() {
            assert.fail('connect shouldnt be raised here');
        });
        ws.on('close', function() {
            done();
        });
    },
    'send before connect should fail': function(done) {
        var ws = new WebSocket('ws://echo.websocket.org');
        try {
            ws.send('hi');
        }
        catch (e) {
            ws.terminate();
            done();
        }
    },
    'send without data should fail': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                try {
                    ws.send();
                }
                catch (e) {
                    srv.close();
                    ws.terminate();
                    done();
                }
            });
        });
    },
    'ping before connect should fail': function(done) {
        var ws = new WebSocket('ws://echo.websocket.org');
        try {
            ws.ping();
        }
        catch (e) {
            ws.terminate();
            done();
        }
    },
    'invalid server key is denied': function(done) {
        server.createServer(++port, server.handlers.invalidKey, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('error', function() {
                srv.close();
                done();
            });
        });
    },
    'disconnected event is raised when server closes connection': function(done) {
        server.createServer(++port, server.handlers.closeAfterConnect, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('close', function() {
                srv.close();
                done();
            });
        });
    },
    'send calls optional callback when flushed': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.send('hi', function() {
                    srv.close();
                    ws.terminate();
                    done();
                });
            });
        });
    },
    'send with unencoded message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.send('hi');
            });
            srv.on('message', function(message, flags) {
                assert.equal(false, flags.masked);
                assert.equal('hi', message);
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'send with encoded message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.send('hi', {mask: true});
            });
            srv.on('message', function(message, flags) {
                assert.ok(flags.masked);
                assert.equal('hi', message);
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'send with unencoded binary message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var array = new Float32Array(5);
            for (var i = 0; i < array.length; ++i) array[i] = i / 2;
            ws.on('open', function() {
                ws.send(array, {binary: true});
            });
            srv.on('message', function(message, flags) {
                assert.ok(flags.binary);
                assert.equal(false, flags.masked);
                assert.ok(areArraysEqual(array, new Float32Array(getArrayBuffer(message))));
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'send with encoded binary message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var array = new Float32Array(5);
            for (var i = 0; i < array.length; ++i) array[i] = i / 2;
            ws.on('open', function() {
                ws.send(array, {mask: true, binary: true});
            });
            srv.on('message', function(message, flags) {
                assert.ok(flags.binary);
                assert.ok(flags.masked);
                assert.ok(areArraysEqual(array, new Float32Array(getArrayBuffer(message))));
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'send with binary stream will send fragmented data': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var callbackFired = false;
            ws.on('open', function() {
                var fileStream = fs.createReadStream('test/fixtures/textfile');
                fileStream.bufferSize = 100;
                ws.send(fileStream, {binary: true}, function(error) {
                    assert.equal(null, error);
                    callbackFired = true;
                });
            });
            srv.on('message', function(data, flags) {
                assert.ok(flags.binary);
                assert.ok(areArraysEqual(fs.readFileSync('test/fixtures/textfile'), data));
                ws.terminate();
            });
            ws.on('close', function() {
                assert.ok(callbackFired);
                srv.close();
                done();                
            });
        });
    },
    'send with text stream will send fragmented data': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var callbackFired = false;
            ws.on('open', function() {
                var fileStream = fs.createReadStream('test/fixtures/textfile');
                fileStream.setEncoding('utf8');
                fileStream.bufferSize = 100;
                ws.send(fileStream, {binary: false}, function(error) {
                    assert.equal(null, error);
                    callbackFired = true;
                });
            });
            srv.on('message', function(data, flags) {
                assert.ok(!flags.binary);
                assert.ok(areArraysEqual(fs.readFileSync('test/fixtures/textfile', 'utf8'), data));
                ws.terminate();
            });
            ws.on('close', function() {
                assert.ok(callbackFired);
                srv.close();
                done();                
            });
        });
    },
    'stream before connect should fail': function(done) {
        var ws = new WebSocket('ws://echo.websocket.org');
        try {
            ws.stream(function() {});
        }
        catch (e) {
            ws.terminate();
            done();
        }
    },
    'stream without callback should fail': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var payload = 'HelloWorld';
            ws.on('open', function() {
                try {
                    ws.stream();
                }
                catch (e) {
                    srv.close();
                    ws.terminate();
                    done();                
                }
            });
        });
    },
    'ping without message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.ping();
            });
            srv.on('ping', function(message) {
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'ping with message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.ping('hi');
            });
            srv.on('ping', function(message) {
                assert.equal('hi', message);
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'ping with encoded message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.ping('hi', {mask: true});
            });
            srv.on('ping', function(message, flags) {
                assert.ok(flags.masked);
                assert.equal('hi', message);
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'pong without message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.pong();
            });
            srv.on('pong', function(message) {
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'pong with message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.pong('hi');
            });
            srv.on('pong', function(message) {
                assert.equal('hi', message);
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'pong with encoded message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.pong('hi', {mask: true});
            });
            srv.on('pong', function(message, flags) {
                assert.ok(flags.masked);
                assert.equal('hi', message);
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'close without message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.close();
            });
            srv.on('close', function(message, flags) {
                assert.equal(false, flags.masked);
                assert.equal('', message);
                srv.close();
                ws.terminate();
                done();
            });        
        });
    },
    'close with message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.close('some reason');
            });
            srv.on('close', function(message, flags) {
                assert.equal(false, flags.masked);
                assert.equal('some reason', message);
                srv.close();
                ws.terminate();
                done();
            });        
        });
    },
    'close with encoded message is successfully transmitted to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                ws.close('some reason', {mask: true});
            });
            srv.on('close', function(message, flags) {
                assert.ok(flags.masked);
                assert.equal('some reason', message);
                srv.close();
                ws.terminate();
                done();
            });        
        });
    },
    'close ends connection to the server': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var connectedOnce = false;
            ws.on('open', function() {
                connectedOnce = true;
                ws.close('some reason', {mask: true});
            });
            ws.on('close', function() {
                assert.ok(connectedOnce);
                srv.close();
                ws.terminate();
                done();
            });
        });
    },
    'very long binary data can be sent and received (with echoing server)': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var array = new Float32Array(5 * 1024 * 1024);
            for (var i = 0; i < array.length; ++i) array[i] = i / 5;
            ws.on('open', function() {
                ws.send(array, {binary: true});
            });
            ws.on('message', function(message, flags) {
                assert.ok(flags.binary);
                assert.ok(areArraysEqual(array, new Float32Array(getArrayBuffer(message))));
                ws.terminate();
                srv.close();
                done();
            });
        });
    },
    'very long binary data can be streamed': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var buffer = new Buffer(10 * 1024);
            for (var i = 0; i < buffer.length; ++i) buffer[i] = i % 0xff;
            ws.on('open', function() {
                var i = 0;
                var blockSize = 800;
                var bufLen = buffer.length;
                ws.stream({binary: true}, function(error, send) {
                    assert.ok(!error);
                    var start = i * blockSize;
                    var toSend = Math.min(blockSize, bufLen - (i * blockSize));
                    var end = start + toSend;
                    var isFinal = toSend < blockSize;
                    send(buffer.slice(start, end), isFinal);
                    i += 1;
                });
            });
            srv.on('message', function(data, flags) {
                assert.ok(flags.binary);
                assert.ok(areArraysEqual(buffer, data));
                ws.terminate();
                srv.close();
                done();
            });
        });
    },
    'streaming data will cause intermittent send to be delayed in order': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var payload = 'HelloWorld';
            ws.on('open', function() {
                var i = 0;
                ws.stream(function(error, send) {
                    assert.ok(!error);
                    if (++i == 1) {
                        send(payload.substr(0, 5));
                        ws.send('foobar');
                        ws.send('baz');
                    }
                    else {
                        send(payload.substr(5, 5), true);
                    }
                });
            });
            var receivedIndex = 0;
            srv.on('message', function(data, flags) {
                ++receivedIndex;
                if (receivedIndex == 1) {
                    assert.ok(!flags.binary);
                    assert.equal(payload, data);
                }
                else if (receivedIndex == 2) {
                    assert.ok(!flags.binary);
                    assert.equal('foobar', data);
                }
                else {
                    assert.ok(!flags.binary);
                    assert.equal('baz', data);
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
        });
    },
    'streaming data will cause intermittent stream to be delayed in order': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var payload = 'HelloWorld';
            ws.on('open', function() {
                var i = 0;
                ws.stream(function(error, send) {
                    assert.ok(!error);
                    if (++i == 1) {
                        send(payload.substr(0, 5));
                        var i2 = 0;
                        ws.stream(function(error, send) {
                            assert.ok(!error);                            
                            if (++i2 == 1) send('foo');
                            else send('bar', true);
                        });
                        ws.send('baz');
                    }
                    else send(payload.substr(5, 5), true);
                });
            });
            var receivedIndex = 0;
            srv.on('message', function(data, flags) {
                ++receivedIndex;
                if (receivedIndex == 1) {
                    assert.ok(!flags.binary);
                    assert.equal(payload, data);
                }
                else if (receivedIndex == 2) {
                    assert.ok(!flags.binary);
                    assert.equal('foobar', data);
                }
                else if (receivedIndex == 3){
                    assert.ok(!flags.binary);
                    assert.equal('baz', data);
                    setTimeout(function() {
                        srv.close();
                        ws.terminate();
                        done();            
                    }, 1000);
                }
                else throw new Error('more messages than we actually sent just arrived');
            });
        });
    },
    'sending stream will cause intermittent send to be delayed in order': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                var fileStream = fs.createReadStream('test/fixtures/textfile');
                fileStream.setEncoding('utf8');
                fileStream.bufferSize = 100;
                ws.send(fileStream);
                ws.send('foobar');
                ws.send('baz');
            });
            var receivedIndex = 0;
            srv.on('message', function(data, flags) {
                ++receivedIndex;
                if (receivedIndex == 1) {
                    assert.ok(!flags.binary);
                    assert.ok(areArraysEqual(fs.readFileSync('test/fixtures/textfile', 'utf8'), data));
                }
                else if (receivedIndex == 2) {
                    assert.ok(!flags.binary);
                    assert.equal('foobar', data);
                }
                else {
                    assert.ok(!flags.binary);
                    assert.equal('baz', data);
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
        });
    },
    'sending stream will cause intermittent stream to be delayed in order': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                var fileStream = fs.createReadStream('test/fixtures/textfile');
                fileStream.setEncoding('utf8');
                fileStream.bufferSize = 100;
                ws.send(fileStream);
                var i = 0;
                ws.stream(function(error, send) {
                    assert.ok(!error);
                    if (++i == 1) send('foo');
                    else send('bar', true);
                });
            });
            var receivedIndex = 0;
            srv.on('message', function(data, flags) {
                ++receivedIndex;
                if (receivedIndex == 1) {
                    assert.ok(!flags.binary);
                    assert.ok(areArraysEqual(fs.readFileSync('test/fixtures/textfile', 'utf8'), data));
                }
                else if (receivedIndex == 2) {
                    assert.ok(!flags.binary);
                    assert.equal('foobar', data);
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
        });
    },
    'streaming data will cause intermittent ping to be delivered': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var payload = 'HelloWorld';
            ws.on('open', function() {
                var i = 0;
                ws.stream(function(error, send) {
                    assert.ok(!error);
                    if (++i == 1) {
                        send(payload.substr(0, 5));
                        ws.ping('foobar');
                    }
                    else {
                        send(payload.substr(5, 5), true);
                    }
                });
            });
            var receivedIndex = 0;
            srv.on('message', function(data, flags) {
                assert.ok(!flags.binary);
                assert.equal(payload, data);
                if (++receivedIndex == 2) {
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
            srv.on('ping', function(data) {
                assert.equal('foobar', data);
                if (++receivedIndex == 2) {
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
        });
    },
    'sending stream will cause intermittent ping to be delivered': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                var fileStream = fs.createReadStream('test/fixtures/textfile');
                fileStream.setEncoding('utf8');
                fileStream.bufferSize = 100;
                ws.send(fileStream);
                ws.ping('foobar');
            });
            var receivedIndex = 0;
            srv.on('message', function(data, flags) {
                assert.ok(!flags.binary);
                assert.ok(areArraysEqual(fs.readFileSync('test/fixtures/textfile', 'utf8'), data));
                if (++receivedIndex == 2) {
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
            srv.on('ping', function(data) {
                assert.equal('foobar', data);
                if (++receivedIndex == 2) {
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
        });
    },
    'streaming data will cause intermittent pong to be delivered': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var payload = 'HelloWorld';
            ws.on('open', function() {
                var i = 0;
                ws.stream(function(error, send) {
                    assert.ok(!error);
                    if (++i == 1) {
                        send(payload.substr(0, 5));
                        ws.pong('foobar');
                    }
                    else {
                        send(payload.substr(5, 5), true);
                    }
                });
            });
            var receivedIndex = 0;
            srv.on('message', function(data, flags) {
                assert.ok(!flags.binary);
                assert.equal(payload, data);
                if (++receivedIndex == 2) {
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
            srv.on('pong', function(data) {
                assert.equal('foobar', data);
                if (++receivedIndex == 2) {
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
        });
    },
    'sending stream will cause intermittent pong to be delivered': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                var fileStream = fs.createReadStream('test/fixtures/textfile');
                fileStream.setEncoding('utf8');
                fileStream.bufferSize = 100;
                ws.send(fileStream);
                ws.pong('foobar');
            });
            var receivedIndex = 0;
            srv.on('message', function(data, flags) {
                assert.ok(!flags.binary);
                assert.ok(areArraysEqual(fs.readFileSync('test/fixtures/textfile', 'utf8'), data));
                if (++receivedIndex == 2) {
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
            srv.on('pong', function(data) {
                assert.equal('foobar', data);
                if (++receivedIndex == 2) {
                    srv.close();
                    ws.terminate();
                    done();            
                }
            });
        });
    },
    'streaming data will cause intermittent close to be delivered': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var payload = 'HelloWorld';
            var errorGiven = false;
            ws.on('open', function() {
                var i = 0;
                ws.stream(function(error, send) {
                    if (++i == 1) {
                        send(payload.substr(0, 5));
                        ws.close('foobar');
                        ws._state = 'disconnected'; // forced, to provoke an error from the next send
                    }
                    else if(i == 2) {
                        send(payload.substr(5, 5), true);
                    }
                    else if (i == 3) {
                        assert.ok(error);
                        errorGiven = true;
                    }
                });
            });
            ws.on('close', function() {
                assert.ok(errorGiven);
                srv.close();
                ws.terminate();
                done();                
            });
            srv.on('message', function(data, flags) {
                assert.ok(!flags.binary);
                assert.equal(payload, data);
            });
            srv.on('close', function(data) {
                assert.equal('foobar', data);
            });
        });
    },
    'sending stream will cause intermittent close to be delivered': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            ws.on('open', function() {
                var fileStream = fs.createReadStream('test/fixtures/textfile');
                fileStream.setEncoding('utf8');
                fileStream.bufferSize = 100;
                ws.send(fileStream);
                ws.close('foobar');
            });
            ws.on('close', function() {
                srv.close();
                ws.terminate();
                done();                
            });
            ws.on('error', function() { /* That's quite alright -- a send was attempted after close */ });
            srv.on('message', function(data, flags) {
                assert.ok(!flags.binary);
                assert.ok(areArraysEqual(fs.readFileSync('test/fixtures/textfile', 'utf8'), data));
            });
            srv.on('close', function(data) {
                assert.equal('foobar', data);
            });
        });
    },
    'close during send stream causes error callback if given': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var errorGiven = false;
            ws.on('open', function() {
                var fileStream = fs.createReadStream('test/fixtures/textfile');
                fileStream.setEncoding('utf8');
                fileStream.bufferSize = 100;
                ws.send(fileStream, function(error) {
                    errorGiven = error != null;
                });
                ws.close('foobar');
                ws._state = 'disconnected'; // forced, to provoke an error from the next send
            });
            ws.on('close', function() {
                setTimeout(function() {
                    assert.ok(errorGiven);
                    srv.close();
                    ws.terminate();
                    done();                
                }, 1000);
            });
        });
    },
    'error causes send queue to clear and connection to reset': function(done) {
        server.createServer(++port, function(srv) {
            var ws = new WebSocket('ws://localhost:' + port);
            var errorCaught = false;
            ws.on('open', function() {
                ws._queue = [];
                ws.emit('error', 'something');
                assert.ok(typeof ws._queue == 'undefined');
                assert.ok(ws._state == 'disconnected');
            });
            ws.on('error', function() {
                errorCaught = true;
            });
            ws.on('close', function() {
                assert.ok(errorCaught);
                srv.close();
                done();                
            });
        });
    },
}