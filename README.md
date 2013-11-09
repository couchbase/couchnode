# Couchbase Node.js Client

This library allows you to connect to a Couchbase cluster from Node.js.
It is a native Node.js module and uses the very fast libcouchbase library to
handle communicating to the cluster over the Couchbase binary protocol.

[![Build Status](http://cb.br19.com:86/buildStatus/icon?job=couchnode)](http://cb.br19.com:86/job/couchnode/)


## Useful Links

Source - http://github.com/couchbase/couchnode

Bug Tracker - http://www.couchbase.com/issues/browse/JSCBC

Couchbase Node.js Community - http://couchbase.com/communities/nodejs


## Installing

To install the lastest release using npm, run:
```
npm install couchbase
```

To install the in development version directly from github, run:
```
npm install git+https://github.com/couchbase/couchnode.git
```


## Introduction

Connecting to a Couchbase bucket is as simple as creating a new Connection
instance.  Once you are connect, you may execute any of Couchbases' numerous
operations against this connection.

Here is a simple example of instantiating a connection, setting a new document
into the bucket and then retrieving its contents:

```javascript
    var couchbase = require('couchbase');
    var db = new couchbase.Connection({bucket: "default"}, function(err) {
      if (err) throw err;

      db.set('testdoc', {name:'Frank'}, function(err, result) {
        if (err) throw err;

        db.get('testdoc', function(err, result) {
          if (err) throw err;

          console.log(result.value);
          // {name: Frank}
        });
      });
    });
```


## Documentation

An extensive documentation is available on the Couchbase website.  Visit our
[Node.js Community](http://couchbase.com/communities/nodejs) on
the [Couchbase](http://couchbase.com) website for the documentation as well as
numerous examples and samples.


## Source Control

The source code is available at
[https://github.com/couchbase/couchnode](https://github.com/couchbase/couchnode).
Once you have cloned the repository, you may contribute changes through our
gerrit server.  For more details see
[CONTRIBUTING.md](https://github.com/couchbase/couchnode/blob/master/CONTRIBUTING.md).

To execute our test suite, run `make test` from your checked out root directory.


## License
Copyright 2013 Couchbase Inc.

Licensed under the Apache License, Version 2.0.

See
[LICENSE](https://github.com/couchbase/couchnode/blob/master/LICENSE)
for further details.
