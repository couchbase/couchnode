couchnode - node.js access to libcouchbase
==========================================

As you probably have guessed already couchnode is my first attemt on
buiding JavaScript API on top of libcouchbase so that you may use it
from node.js.

Before you start looking at the stuff you should probably be aware of
that this is currently work under heavy development.

Given the above; and the fact that I've never written a single line of
JavaScript before I started on this project, the API may look really
ugly for anyone experienced with JavaScript. This is where I'm really
hoping for your contribution! PLEASE don't hesitate sending me an
email telling me how the API _should_ look like (just telling me that
the API is crap doesn't help anyone, because I know that already. I
need to know how it is supposed to look).

Install description
-------------------

I've only tested this on my laptop running macosx, but I would expect
it to be easy to get it to work on other platforms. You need to
install three dependencies before you may build this module. If you're
using homebrew all you need to do is:

   trond@ok> *brew install v8 node*
   trond@ok> *brew install https://raw.github.com/couchbase/homebrew/preview/Library/Formula/libcouchbase.rb*

You would need some of the new features in libcouchbase that will
be released when Couchbase Server 2.0 is released, so that's why
we're using the preview version from libcouchbase.

To build and install the module, simply execute:

   trond@ok> *node-waf configure build install*

API description
---------------

So lets walk through the API so you'll get a feeling on how to use
it. Please bear with me for using the wrong terms for things (remember
that I don't know much JavaScript ;-))

The first thing we need to do is to load the driver and create an
instance of libcouchbase to use:

    var driver = require('couchbase');
    var cb = new driver.Couchbase("server:8091");

The constructor takes multiple arguments. In its simplest form (as
shown above) all you specify is the location of the REST port for your
cluster. This will connect you to the *default bucket* in the
cluster. You may also specify credentials and the name of another
bucket to connect to. The full prototype for the constructor is:

    Couchbase(String hostname,
              String user,
              String password,
              String bucket)


After creating a new instance, you should ask `cb` to connect
to the cluster:

    cb.connect(function() {
        console.log("I am connected!");
    });

If connection fails, the `errorHandler` will know about this.

You may also register for the "connect" event by doing:

    cb.on("connect", function() {
        console.log("I am connected!");
    });

Due to a limitation within Couchnode, you *must* wait for the
connection to complete (though this itself is a purely asynchronous
process) and not schedule any operations before the handle has been
connected.

This is because the internal key hashing depends on VBucket
configurations which can only be known once `connect` has completed

Operations
----------

The API in this version of Couchnode is meant to be easy for use C and C++
developers to modify and adjust to, therefore some of the arguments are
fairly weird.

Couchnode exposes the basic commandset offered by libcouchbase:


Get
---

    cb.get(
        "key_string",
        expiration_time_offset,
        function (data, error, key, cas, value) {
                console.log("Got %s=>%s for request '%s'", key, value, data);
        },
        "opaque");

Expiration time should be set to 0 or `undefined` if you do not wish
to set an expiration time.

The callback is mandatory (but it can be a global function and not
necessarily an inline one). The 'data' argument is an opaque value of
your choosing to be passed to the callback as its first argument. This
is useful if you wish to use a global callback but still be able to
distinguish between requests.

On success, error will be false, otherwise, it is an error number as
described in `<libcouchbase/types.h>`


Store
---

So how do we store stuff in the couchbase cluster? We do that by using
one of the storage methods: add, set, replace, append, prepend. Even
though they return a boolean, the methods does not return the final
action of the operation (you need to check the callback for that), but
if the operation was _intitated_ or not.

    cb.set(
        "key_string",
        "value_string",
        expiration_time_offset,
        cas_number,

        function (data, error, key, cas) {
                // ....
        },
        "anything_you_want");


Stores the value for the key. If you specify a cas value the operation
will only succeed if the cas value for the object stored on the server
is the same as the one you specified.

The following functions also conform to this calling convention

    // replace value, if the key exists
    cb.replace(...)

    // set the value only if it does not exist
    cb.add(...)

    // prepend to existing value
    cp.prepend(...)

    // append to existing value
    cb.append(...)


Arithmetic (AKA incr and decr)
----------


    cb.arithmetic(
        "string_key",
        signed_offset,
        initial_value,
        cas,
        expiry_offset,
        get_callback,
        "opaque");

Perform arithmetic on an operation, this is equivalent to the
traditional 'incr' and 'decr' functions in memcached APIs (and may be
wrapped as such)

The signed offset is a positive or negative value by which to modify
the stored integer value; for incr, this value would be `1` and for
decr this would be `-1`.

If the value does not exist, it will be set to `initial_value` (set
this argument to `undefined` if you do not desire an initial value`

`cas` is a no-op for this function.

The callback for this function is identical to that of the `get`
callback.


Miscellaneous Operations
------------------------

    cb.remove(
        "string_key",
        cas,
        function (data, error, key) { ... },
        "opaque"
    );

Removes the key; if `cas` is specified, only removes the entry if it
exists on the server with the specified CAS value.

    cb.touch(
        "string_key",
        expiration,
        function (data, error, key) { ... },
        "opaque"
    );

Updates the expiration time of the key.


If you're having problems or suggestions on how I may improve the
library please send me an email!

Happy hacking!

Trond Norbye <trond.norbye@gmail.com>

Mangled by Mark Nunberg <mnunberg@haskalah.org>
