couchnode - node.js access to libcouchbase
==========================================

This library allows you to connect to a Couchbase cluster from node.js

Basic installation and usage
--------------------

To install this module, we'll assume you are using [NPM](https://npmjs.org).
However it is not as simple as a regular JavaScript module,
as it depends on the C-library for Couchbase clients,
[libcouchbase](https://github.com/couchbase/libcouchbase). Libcouchbase
also powers other dynamic language clients, such as Ruby and PHP, so
if you've worked with those clients you should feel right at home.

First step is to install libcouchbase (the 2.0 beta verion). On a Mac
with homebrew this should be as easy as running:

    brew install https://github.com/couchbase/homebrew/raw/preview/Library/Formula/libcouchbase.rb

Once you have libcouchbase installed, you can proceed to install the
`couchbase` module by running:

    npm install couchbase

Do note that this module requires the very latest version of libcouchbase,
so if you see errors like `error: ‘struct lcb_io_opt_st’ has no member named ‘v’`, you may have to install libcouchbase from
source until we cut another release.

For API illustration, the best bet at the current time is [a small example http hit counter](https://github.com/couchbase/couchnode/tree/master/example.js). There is also [the test suite which shows more details.](https://github.com/couchbase/couchnode/tree/master/tests)

Contributing changes
--------------------

We've decided to use "gerrit" for our code review system, making it
easier for all of us to contribute with code and comments. You'll
find our gerrit server running at:

http://review.couchbase.org/

The first thing you would do would be to "sign up" for an account
there, before you jump to:

http://review.couchbase.org/#/q/status:open+project:couchnode,n,z

With that in place you should probably jump on IRC and join the #libcouchbase
chatroom to hang out with the rest of us :-)

There is a pretty tight relationship between our node.js driver
development and the development of libcouchbase, so for now you have
to run the latest versions f both projects to be sure that everything
works. I have however made it easy for you to develop on couchstore by
using a repo manifest file. If you haven't done so already you should
download repo from http://code.google.com/p/git-repo/downloads/list
and put it in your path.

All you should need to set up your development environment should be:

    trond@ok ~> mkdir sdk
    trond@ok ~> cd sdk
    trond@ok ~/sdk> repo init -u git://github.com/trondn/manifests.git -m sdk.xml
    trond@ok ~/sdk> repo sync
    trond@ok ~/sdk> repo start my-branch-name --all
    trond@ok ~/sdk> gmake nodejs

This will build the latest version of libcouchbase and the couchnode
driver. You must have a C and C++ compiler installed, automake,
autoconf, node and v8.

If you have to make any changes in libcouchbase or couchnode,
all you can just commit them before you upload them to gerrit with the
following command:

    trond@ok ~/sdk> repo upload

You might experience a problem trying to upload the patches if you've
selected a different login name review.couchbase.org than your login
name. Don't worry, all you need to do is to add the following to your
~/.gitconfig file:

    [review "review.couchbase.org"]
            username = trond

I normally don't go looking for stuff in gerrit, so you should add at
least me (trond.norbye@gmail.com) as a reviewer for your patch (and
I'll know who else to add and add them for you).

Install description
-------------------

You would need to have libcouchbase installed _before_ you can build
the node extension. If you have installed libcouchbase in a location
that isn't part of the default search path for your compiler, linker
and runtime linker, you have to set the appropriate flags. ex:

    CPPFLAGS="-I/opt/local/include" LDFLAGS="-L/opt/local/lib -Wl,-rpath,/opt/local/lib" node-waf configure

To build and install the module, simply execute:

    trond@ok> node-waf configure build install

API description
---------------

Unfortunately this isn't documented yet, but you should be able to
get a pretty good idea on how it works from looking at the tests :)
