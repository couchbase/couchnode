couchnode - node.js access to libcouchbase
==========================================

As you probably have guessed already couchnode is my first attemt on
buiding JavaScript API on top of libcouchbase so that you may use it
from node.js.

Before you start looking at the stuff you should probably be aware of
that this is currently work under heavy development. Although
libcouchbase is designed to be plugged into an event loop I've heard
that it wouldn't work out of the box ;-) Instead of starting way down
in libcouchbase trying to refactor everything so that it would work
for node.js, I decided to start in the other end by creating an API
that would allow you use libcouchbase from JavaScript, but you would
have to _block_ while waiting for the operations to be executed on the
server. When I got that working I'm going to refactor the internals
of libcouchbase so that it integrates better with node.js.

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
install two dependencies before you may build this module. If you're
using homebrew all you need to do is:

   trond@ok> *brew install v8 node*

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

Given that the current version of the API pretty much maps down to
libcouchbase, the next thing we need to do is to specify the callbacks
libcouchbase will call when an operation completes. This is done with
the following methods:

    cb.setErrorHandler(errorHandler);
    cb.setGetHandler(getHandler);
    cb.setStorageHandler(storageHandler);

All of these handlers should be changed. They are not thought true,
and is a result that I just wanted to get something up'n running so
that I could test it ;) The error handler looks
like:

    function errorHandler(String errorMessage);

As you see you don't have much context here. It should be extended to
contain a reference to the object who failed. Why it isn't an
exception? Well this error handler is called when we're running the
event loop...

The get handler is triggered for a get request and returns the data
for the item. Its signature looks like:

    function getHandler(Boolean state,
                        String key,
                        String value,
                        Number flags,
                        Number cas);

If state is true it means that the object was found and key, value,
flags and cas should contain the information about the object. If
state is false it means that an error occured, and key contains an
error message.

The storage handler is called for all of the storage operations (add,
set, replace, append, prepend) when the operation completes. Its
prototype looks like:

    function storageHandler(Boolean state,
                            String key,
                            Number cas);

If state is true it means that the key specified by key was stored and
given the id of cas. If state is false the object was not stored and
the third argument is a String describing the error.

Now that we've gotten the callbacks set up we can start using our
library (you don't need to set up any callbacks, but then you wouldn't
know when something goes wrong, or the result of your
operations). Before we can do anything we need to connect to the
cluster, and get the current vbucket configuration. This is done by
the connect call:

    Bool connect();

Connect does *not* wait until we're connected to the server, all it
does is to _initiate_ the connect. If the function fails you may call
getLastError in order to get an error message describing the error:

    String getLastError();

As I said calling connect() doesn't wait for the operation to
complete. In order to wait for the completion of the pending
operation(s), we can call wait():

    Boolean wait();

So how do we store stuff in the couchbase cluster? We do that by using
one of the storage methods: add, set, replace, append, prepend. Even
though they return a boolean, the methods does not return the final
action of the operation (you need to check the callback for that), but
if the operation was _intitated_ or not. All parameters excepts the
key are optional. You *may* also specify the callback function as
the first parameter. If you choose to do so the global callback
function will _not_ be called.

    Boolean add(String key,
                String value,
                Number flags,
                Number exptime);

Add adds the key to the cache if it doesn't exist.

    Boolean set(String key,
                String value,
                Number flags,
                Number exptime);

Unconditionally store the key in the cache.

    Boolean replace(String key,
                    String value,
                    Number flags,
                    Number exptime,
                    Number cas);

Replace the object identified by key with this object. If you specify
a cas value the operation will only succeed if the cas value for the
object stored on the server is the same as the one you specified.

    Boolean append(String key,
                   String value,
                   Number flags,
                   Number exptime,
                   Number cas);

    Boolean prepend(String key,
                    String value,
                    Number flags,
                    Number exptime,
                    Number cas);

Append/prepend the value you specified with to the value stored in the
cluster.

Now that we know how to store objects in the cluster we probably want
to know how we can get them back. This is performed by the get method:

    Boolean get(String key [, String keyn ]*);

You may also specify the callback function as the first parameter to
the get call.

So to continue on our example we would now have:

    // A callback function that is called from libcouchbase
    // when it encounters a problem without an operation context
    function errorHandler(errorMessage) {
        console.log("ERROR: [" + errorMessage + "]");
        process.exit(1);
    }

    // A callback function that is called for get requests
    function getHandler(state, key, value, flags, cas) {
        if (state) {
            console.log("Found \"" + key + "\" - [" + value + "]");
        } else {
            console.log("Get failed for \"" + key + "\" [" + value + "]");
        }
    }

    // A callback function that is called for storage requests
    function storageHandler(state, key, cas) {
        if (state) {
            console.log("Stored \"" + key + "\" - [" + cas + "]");
        } else {
            console.log("Failed to store \"" + key + "\" [" + cas + "]");
        }
    }

    // Load the driver and create an instance that connects
    // to our cluster running at "myserver:8091"
    var driver = require('couchbase');
    var cb = new driver.Couchbase("myserver");

    // Set up the handlers
    cb.setErrorHandler(errorHandler);
    cb.setGetHandler(getHandler);
    cb.setStorageHandler(storageHandler);

    // Try to connect to the server
    if (!cb.connect()) {
        console.log("Failed to connect! [" + cb.getLastError() + "]");
        process.exit(1);
    }
    // Wait for the connect attempt to complete
    cb.wait();

    // Schedule a couple of operations
    cb.add("key", "add")
    cb.replace("key", "replaced")
    cb.set("key", "set")
    cb.append("key", "append")
    cb.prepend("key", "prepend")
    cb.get("key");

    // Wait for all operations to complete
    cb.wait();

If you're having problems or suggestions on how I may improve the
library please send me an email!

Happy hacking!

Trond Norbye <trond.norbye@gmail.com>
