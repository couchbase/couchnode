We've decided to use "gerrit" for our code review system, making it
easier for all of us to contribute with code and comments. You'll
find our gerrit server running at:

http://review.couchbase.org/

The first thing you would do would be to "sign up" for an account
there, before you jump to:

http://review.couchbase.org/#/q/status:open+project:libcouchbase,n,z

With that in place you should probably jump on IRC and join the #libcouchbase
chatroom to hang out with the rest of us :-)

If you haven't done so already you should download repo from
http://code.google.com/p/git-repo/downloads/list and put it in your
path.

All you should need to set up your development environment should be:

    trond@ok ~> mkdir devel
    trond@ok ~> cd devel
    trond@ok ~/devel> repo init -u git://github.com/trondn/manifests.git -m libcouchbase.xml
    trond@ok ~/devel> repo sync
    trond@ok ~/devel> repo start my-branch-name --all
    trond@ok ~/devel> cd lcb

When you're done making your changes to libcouchbase (check the
"hacking" section in README.markdown), commit them to the repository
by using git commit, and upload them to gerrit with the following
command:

    trond@ok ~/devel> repo upload

You might experience a problem trying to upload the patches if you've
selected a different login name review.couchbase.org than your login
name. Don't worry, all you need to do is to add the following to your
~/.gitconfig file:

    [review "review.couchbase.org"]
            username = trond

I normally don't go looking for stuff in gerrit, so you should add at
least me (trond.norbye@gmail.com) or Sergey Avseyev
<sergey.avseyev@gmail.com> as a reviewer for your patch (and we'll
know who else to add and add them for you).
