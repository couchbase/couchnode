# Couchbase C Client

[![Build Status](https://travis-ci.org/couchbase/libcouchbase.png?branch=master)](https://travis-ci.org/couchbase/libcouchbase)

This is the C client library for [Couchbase](http://www.couchbase.com)
It communicates with the cluster and speaks the relevant protocols
necessary to connect to the cluster and execute data operations.

## Features

* Can function as either a synchronous or asynchronous library
* Callback Oriented
* Can integrate with most other asynchronous environments. You can write your
  code to integrate it into your environment. Currently support exists for
    * [libuv](http://github.com/joyent/libuv) (Windows and POSIX)
    * [libev](http://software.schmorp.de/pkg/libev.html) (POSIX)
    * [libevent](http://libevent.org/) (POSIX)
    * `select` (Windows and POSIX)
    * IOCP (Windows Only)
* Support for operation batching
* ANSI C ("_C89_")
* Cross Platform - Tested on Linux, OS X, and Windows.

## Building

Before you build from this repository, please check the [Couchbase C
Portal](http://couchbase.com/communities/c) to see if there is a binary
or release tarball available for your needs. Since the code here is
not part of an official release it has therefore not gone through our
release testing process.

For building you have two options; the first is via GNU autotools and
the second is via CMake. Autotools provides more packaging flexibility
while CMake integrates better into your normal (C/C++) development
environment. CMake is also the only way to build the library on Windows.

### Dependencies
The library comes with no mandatory third party dependencies; however
by default it will demand that at least `libevent`, `libev`, or `libuv`
are installed as those are the most tested I/O platforms.

If you are building libcouchbase as a depdency for an application which
contains its own event loop implementation then you may specify the
`--disable-plugins` option to the configure script.

Additionally, in order to run the tests you will need to have java
installed.  The tests make use of a mock server written in Java.

The binary command line tools (i.e. `cbc`) and tests require a C++
compiler. The core library requires only C.

### Building with autotools

In order to build with autotools you need to generate the `configure` script
first. This requires `autoconf`, `automake`, `libtool` and friends.

```shell
$ ./config/autorun.sh
$ ./configure
$ make
$ make check
$ make install
```

You may run `./configure --help` to see a list of build options

### Building with CMake (*nix)

Provided is a convenience script called `cmake/configure`. It is a Perl
script and functions like a normal `autotools` script.

```shell
$ mkdir lcb-build # sibling of the git tree
$ cd lcb-build
$ ../libcouchbase/cmake/configure
$ make
$ ctest
```


### Building with CMake (Windows)

Spin up your visual studio shell and run cmake from there. It is best
practice that you make an out-of-tree build; thus like so:

Assuming Visual Studio 2010

```
C:\> git clone git://github.com/couchbase/libcouchbase.git
C:\> mkdir lcb-build
C:\> cd lcb-build
C:\> cmake -G "Visual Studio 10" ..\libcouchbase
C:\> msbuild /M libcouchbase.sln
```

This will generate and build a Visual Studio `.sln` file.

Windows builds are known to work on Visual Studio versions 2008, 2010 and
2012.

## Bugs, Support, Issues
You may report issues in the library in our issue tracked at
<http://couchbase.com/issues>. Sign up for an account and file an issue
against the _Couchbase C Client Library_ project.

The developers of the library hang out in IRC on `#libcouchbase` on
irc.freenode.net.


## Examples

* The `examples` directory
* Client libraries wrapping this library
    * [node.js](http://github.com/couchbase/couchnode)
    * [Python](http://github.com/couchbase/couchbase-python-client)
    * [Ruby](http://github.com/couchbase/couchbase-ruby-client)
* [<http://http://trondn.blogspot.com/2012/01/so-how-do-i-use-this-libcouchbase.html>]()
  Old example based on version 1.x of the library

## Documentation
API Documentation exists inline with the headers in the
`include/libcouchbase` directory. `man`-pages are also available in the
`man` directory and are installed via `make install`.

## Contributing

In addition to filing bugs, you may contribute by submitting patches
to fix bugs in the library. Contributions may be submitting to
<http://review.couchbase.com>.  We use Gerrit as our code review system -
and thus submitting a change would require an account there. Note that
pull requests will not be ignored but will be responded to much quicker
once they are converted into Gerrit.

For something to be accepted into the codebase, it must be formatted
properly and have undergone proper testing. While there are no formatting
guidelines per se, the code should look similar to the existing code
within the library.

## Branches and Tags

Released versions of the library are marked as annotated tags inside
the repository.

* The `release10` contains the older 1.x versions of the library.
* The `master` branch represents the mainline branch. The master
  branch typically consists of content going into the next release.
* The `packet-ng` branch contains the next generation version of the
  library with improved packet handling.


## Contributors

See the `AUTHORS` file


## License

libcouchbase is licensed under the Apache 2.0 License. See `LICENSE` file for
details.
