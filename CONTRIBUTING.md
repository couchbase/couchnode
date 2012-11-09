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
