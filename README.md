# Couchnode - Fast and Native Node.JS Client for Couchbase


This library allows you to connect to a Couchbase cluster from node.js.
It is very fast and utilizes the binary protocol via a native node.js
addon.

## Basic installation and usage

To install this module, we'll assume you are using
[NPM](https://npmjs.org).  However it is not as simple as a regular
JavaScript module, as it depends on the C-library for Couchbase
clients, [libcouchbase](https://github.com/couchbase/libcouchbase).
Libcouchbase also powers other dynamic language clients, such as Ruby
and PHP, so if you've worked with those clients you should feel right
at home.

First, you must install libcouchbase (version 2.1 or greater)

On a mac, you can use homebrew this should be as easy as running:

    brew install libcouchbase


### Building from Git
Since you're reading this README, we're assuming you're going to be building
from source. In this case, `cd` into the source root directory and run

    npm install --debug

If your libcouchbase prefix is not inside the linker path, you can pass the
`--couchbase-root` option over to `npm` like so:

    npm install --debug --couchbase-root=/sources/libcouchbase/inst

Note that `--couchbase-root` also sets the `RPATH` flags and assumes you are
using an `ELF`-based platform (i.e. not OS X). To build on OS X, edit the
bindings.gyp to replace `-rpath` with the appropriate linker flags.


## API description

### Connecting.

To use this module, first do:

```javascript
    var Couchbase = require('couchbase');
    var cb = new Couchbase.Connection({bucket: "default"}, function(err) { });
```

Note that you do not need to wait for the connection callback in order to start
performing operations.

### Dealing with keys and values

For API illustration, the best bet at the current time is [a small
example http hit
counter](https://github.com/couchbase/couchnode/tree/master/example.js). There
is also [the test suite which shows more details.]
(https://github.com/couchbase/couchnode/tree/master/tests)

The basic method summary is:

```javascript
    cb.get(key, function (err, result) {
      console.log("Value for key is: " + result.value);
    });

    cb.set(key, value, function (err, result) {
      console.log("Set item for key with CAS: " + result.cas);
    });

    // Then the similar methods of add, replace, append, prepend:
    cb.add(key, value, function (err, result) {});
    cb.replace(key, value, function (err, result) {});
    cb.append(key, value, function (err, result) {});
    cb.prepend(key, value, function (err, result) {});

    // Increment or decrement a numeric value:
    cb.incr(key, { delta: 42, initial: 20 }, function(err, result) {
      console.log("New value for counter is: " + result.value);
    });
    cb.decr(key, { delta: 99, default: 1024 }, function (err, result) {});

    // Remove items
    cb.remove(key, function (err, result));

    // Set multiple items:
    cb.setMulti({
      key1: { value: value1 },
      // You can set per-key options, like expiry as well.
      key2: { value: value2, expiry: 1000 } },

      // Use the "spooled" option to ensure the callback is invoked only once
      // with the result for all the items.
      { expiry: 300, spooled: true  },
      function (err, results) {
        console.dir(results);
      }
    );

    // Get multiple items:
    // Note we don't pass options and don't use spooled, so the callback is
    // invoked for each key.
    cb.getMulti(["key1", "key2", "key3"], null, function(err, result) {
      console.log("Got result for key.. " + result.value);
    });
```

## Running Tests

To run the unit tests built into the Node.js driver.  Make sure you have
mocha installed globally on your system, then execute mocha in the root
directory of your couchnode installation.

## Contributing changes

See CONTRIBUTING.md
