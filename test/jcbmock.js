'use strict'

var os = require('os')
var path = require('path')
var fs = require('fs')
var http = require('http')
var net = require('net')
var child_process = require('child_process')

var defaultMockVersion = [1, 5, 25]
var defaultMockVersionStr =
  defaultMockVersion[0] +
  '.' +
  defaultMockVersion[1] +
  '.' +
  defaultMockVersion[2]
var defaultMockFile = 'CouchbaseMock-' + defaultMockVersionStr + '.jar'
var defaultMockUrlBase = 'http://packages.couchbase.com/clients/c/mock/'

function _getMockVer() {
  return defaultMockVersion
}

module.exports.version = _getMockVer

function _getMockJar(callback) {
  var mockpath = path.join(os.tmpdir(), defaultMockFile)
  if (process.env.JSCB_MOCK_PATH) {
    mockpath = process.env.JSCB_MOCK_PATH
  }

  var mockurl = defaultMockUrlBase + defaultMockFile
  if (process.env.JSCB_MOCK_URL) {
    mockurl = process.env.JSCB_MOCK_URL
  }

  // Check if the file already exists
  fs.stat(mockpath, function (err, stats) {
    if (!err && stats.isFile() && stats.size > 0) {
      callback(null, mockpath)
      return
    }

    // Remove whatever was there
    fs.unlink(mockpath, function () {
      // we ignore any errors here...

      console.log('downloading ' + mockurl + ' to ' + mockpath)

      var file = fs.createWriteStream(mockpath)
      http.get(mockurl, function (res) {
        if (res.statusCode !== 200) {
          callback(new Error('failed to get mock from server'))
          return
        }

        res
          .on('data', function (data) {
            file.write(data)
          })
          .on('end', function () {
            file.end(function () {
              callback(null, mockpath)
            })
          })
      })
    })
  })
}

function _bufferIndexOf(buffer, search) {
  if (buffer.indexOf instanceof Function) {
    return buffer.indexOf(search)
  } else {
    if (typeof search === 'string') {
      search = Buffer.from(search)
    } else if (typeof search === 'number' && !isNaN(search)) {
      search = Buffer.from([search])
    }
    for (var i = 0; i < buffer.length; ++i) {
      if (buffer[i] === search[0]) {
        return i
      }
    }
    return -1
  }
}

function _startMock(mockpath, options, callback) {
  if (callback === undefined) {
    callback = options
    options = undefined
  }
  if (!options) {
    options = {}
  }

  if (!options.replicas) {
    options.replicas = 0
  }
  if (!options.vbuckets) {
    options.vbuckets = 32
  }
  if (!options.nodes) {
    options.nodes = 4
  }
  if (!options.buckets) {
    options.buckets = {
      default: {
        password: '',
        type: 'couchbase',
      },
    }
  }
  for (var bname in options.buckets) {
    if (Object.prototype.hasOwnProperty.call(options.buckets, bname)) {
      if (!options.buckets[bname].type) {
        options.buckets[bname] = 'couchbase'
      }
    }
  }

  var server = net.createServer(function (socket) {
    // Close the socket immediately
    server.close()

    var readBuf = null
    var mockPort = -1
    var msgHandlers = []
    socket.on('data', function (data) {
      if (readBuf) {
        readBuf = Buffer.concat([readBuf, data])
      } else {
        readBuf = data
      }

      while (readBuf.length > 0) {
        if (mockPort === -1) {
          var nullIdx = _bufferIndexOf(readBuf, 0)
          if (nullIdx >= 0) {
            var portStr = readBuf.slice(0, nullIdx)
            readBuf = readBuf.slice(nullIdx + 1)
            mockPort = parseInt(portStr, 10)

            socket.entryPort = mockPort

            callback(null, socket)
            continue
          }
        } else {
          var termIdx = _bufferIndexOf(readBuf, '\n')
          if (termIdx >= 0) {
            var msgBuf = readBuf.slice(0, termIdx)
            readBuf = readBuf.slice(termIdx + 1)

            var msg = JSON.parse(msgBuf.toString())

            if (msgHandlers.length === 0) {
              console.error('mock response with no handler')
              continue
            }
            var msgHandler = msgHandlers.shift()

            if (msg.status === 'ok') {
              msgHandler(null, msg.payload)
            } else {
              var err = new Error('mock error: ' + msg.error)
              msgHandler(err, null)
            }

            continue
          }
        }
        break
      }
    })
    socket.on('error', function (err) {
      console.error('mocksock err', err)
    })
    socket.command = function (cmdName, payload, callback) {
      if (callback === undefined) {
        callback = payload
        payload = undefined
      }

      msgHandlers.push(callback)
      var dataOut =
        JSON.stringify({
          command: cmdName,
          payload: payload,
        }) + '\n'
      socket.write(dataOut)
    }
    socket.close = function () {
      socket.end()
    }
    console.log('got mock server connection')
  })
  server.on('error', function (err) {
    callback(err)
  })
  server.on('listening', function () {
    var ctlPort = server.address().port

    var bucketInfo = ''
    for (var bname in options.buckets) {
      if (Object.prototype.hasOwnProperty.call(options.buckets, bname)) {
        var binfo = options.buckets[bname]
        if (bucketInfo !== '') {
          bucketInfo += ','
        }
        bucketInfo +=
          bname +
          ':' +
          (binfo.password ? binfo.password : '') +
          ':' +
          (binfo.type ? binfo.type : '')
      }
    }

    var javaOpts = [
      '-jar',
      mockpath,
      '--cccp',
      '--harakiri-monitor',
      'localhost:' + ctlPort,
      '--port',
      '0',
      '--replicas',
      options.replicas.toString(),
      '--vbuckets',
      options.vbuckets.toString(),
      '--nodes',
      options.nodes.toString(),
      '--buckets',
      bucketInfo,
    ]
    console.log('launching mock:', javaOpts)

    // Start Java Mock Here...
    var mockproc = child_process.spawn('java', javaOpts)
    mockproc.on('error', function (err) {
      server.close()
      callback(err)
      return
    })
    mockproc.stderr.on('data', function (data) {
      console.error('mockproc err: ' + data.toString())
    })
    mockproc.on('close', function (code) {
      if (code !== 0 && code !== 1) {
        console.log('mock closed with non-zero exit code: ' + code)
      }
      server.close()
    })

    mockproc.stdout.on('data', function (data) {
      console.log(data)
    })
  })
  server.listen()
}

function _createMock(options, callback) {
  _getMockJar(function (err, mockpath) {
    if (err) {
      callback(err)
      return
    }

    _startMock(mockpath, options, callback)
  })
}
module.exports.create = _createMock
