couchnode - node.js access to libcouchbase
==========================================

This library allows you to connect to a Couchbase cluster from node.js

Basic installation and usage
--------------------

To install this module, we'll assume you are using
[NPM](https://npmjs.org).  However it is not as simple as a regular
JavaScript module, as it depends on the C-library for Couchbase
clients, [libcouchbase](https://github.com/couchbase/libcouchbase).
Libcouchbase also powers other dynamic language clients, such as Ruby
and PHP, so if you've worked with those clients you should feel right
at home.

First step is to install libcouchbase (the 2.0 version). On a Mac with
homebrew this should be as easy as running:

    brew install libcouchbase

Once you have libcouchbase installed, you can proceed to install the
`couchbase` module by running:

    npm install couchbase

Do note that this module requires the very latest version of
libcouchbase, so if you see errors like `error: ‘struct lcb_io_opt_st’
has no member named ‘v’`, you may have to install libcouchbase from
source until we cut another release.


API description
---------------

For API illustration, the best bet at the current time is [a small
example http hit
counter](https://github.com/couchbase/couchnode/tree/master/example.js). There
is also [the test suite which shows more
details.](https://github.com/couchbase/couchnode/tree/master/tests)

    get:       cb.get(testkey, function (err, doc, meta) {})
    set:       cb.set(testkey, "bar", function (err, meta) {})
    replace:   cb.replace(testkey, "bar", function(err, meta) {})
    delete:    cb.delete(testkey, function (err, meta) {})
    multiget:  cb.get(['key1', 'key2', '...'], function(err, doc, meta) {})

Contributing changes
--------------------

See CONTRIBUTING.md

Install description
-------------------

You would need to have libcouchbase installed _before_ you can build
the node extension. If you have installed libcouchbase in a location
that isn't part of the default search path for your compiler, linker
and runtime linker, you have to set the appropriate flags. ex:

    EXTRA_CPPFLAGS="-I/opt/local/include"
    EXTRA_LDFLAGS="-L/opt/local/lib -Wl,-rpath,/opt/local/lib"
