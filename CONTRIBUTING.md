Gerrit is the code review system in use, making it easier
for all of us to contribute with code and comments. This
means there are no GitHub Pull Requests to open or emails
with patches to send.

Instead, sign in to Gerrit at http://review.couchbase.org/

Review the [Individual Contributor Agreement](http://review.couchbase.org/static/individual_agreement.html)
and agree to it in http://review.couchbase.org/#/settings/agreements

Feel free to check out the [Couchnode project](http://review.couchbase.org/#/q/status:open+project:couchnode)
and join us on IRC at [#libcouchbase on Freenode](https://webchat.freenode.net?channels=%23libcouchbase).

When submitting a patch, add at least Brett Lawson (brett19@gmail.com)
as a reviewer for it. He'll know who else to add and do that for you.

# `repo`

Gerrit integrates well with `repo` - a tool built on top of Git to help
manage repositories and handle uploads to revision control. You can
download it from https://storage.googleapis.com/git-repo-downloads/repo
and put it in your PATH.

All you need to do for your local development environment should be:

    $ mkdir sdk
    $ cd sdk

    $ repo init -u git://github.com/couchbase/manifest.git -m couchnode/master.xml
    $ repo sync

    $ repo start branch-name --all
    $ make install

You must have a C and C++ compiler installed,
automake, autoconf, Node and v8.

If you are making any changes to the project, just commit them
and upload to Gerrit by running:

    $ repo upload

If you experience trouble with your login name not matching the one
that is set at http://review.couchbase.org/#/settings/ all you need
to do is add your username to your Git configuration:

    $ git config --global review.review.couchbase.org.username trond

You can read the Repo Command Reference at https://source.android.com/setup/develop/repo
to learn more about how it fits together with Gerrit.

# Pure Git

Alternatively, you can also contribute using pure Git. In order to push
to Gerrit, your commit message needs a ChangeId reference edded. Set up
a local commit message hook in order to automatically do that:

    $ curl -Lo .git/hooks/commit-msg http://review.couchbase.org/tools/hooks/commit-msg
    $ chmod +x .git/hooks/commit-msg

If you already committed before setting up the hook, amend your commit:

    $ git commit --amend

Depending on whether you configured
[SSH](http://review.couchbase.org/#/settings/ssh-keys) or
[HTTP](http://review.couchbase.org/#/settings/http-password)
authentication on your account in Gerrit,
pushing changes is as simple as one of the following `git push` calls:

    $ git push http://trond@review.couchbase.org/couchnode.git HEAD:refs/for/master
    $ git push ssh://trond@review.couchbase.org:29418/couchnode.git HEAD:refs/for/master

You might want to configure a remote as to easily `git push review`:

    $ git config remote.review.url ssh://trond@review.couchbase.org:29418/couchnode.git
    $ git config remote.review.push HEAD:refs/for/master

You can read more details about how to use plain Git with Gerrit at
http://review.couchbase.org/Documentation/user-upload.html
