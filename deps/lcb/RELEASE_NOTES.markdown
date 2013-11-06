# Release Notes

This document is a list of user visible feature changes and important
bugfixes. Do not forget to update this doc in every important patch.

## 2.2.0 (2013-10-05)

* [major] CCBC-169 Handle 302 redirects in HTTP (views, administrative
  requests). By default the library will follow up to three redirects.
  Once the limit reached the request will be terminated with code
  `LCB_TOO_MANY_REDIRECTS`. Limit is configurable through
  `LCB_CNTL_MAX_REDIRECTS`. If set to -1, it will disable redirect
  limit.

      int new_value = 5;
      lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_MAX_REDIRECTS, &new_value);

* [major] CCBC-243 Replace isasl with cbsasl, the latter has
  implemented both PLAIN and CRAM-MD5 authentication mechanisms.

  * `LCB_CNTL_MEMDNODE_INFO` command updated to include effective
    SASL mechanism:

        cb_cntl_server_t node;
        node.version = 1;
        node.v.v1.index = 0; /* first node */
        lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_MEMDNODE_INFO, &node);
        if (node.v.v1.sasl_mech) {
            printf("authenticated via SASL '%s'\n",
                   node.v.v1.sasl_mech);
        }

  * It is also possible to force specific authentication mechanism for
    the connection handle using `LCB_CNTL_FORCE_SASL_MECH` command:

        lcb_cntl(instance, LCB_CNTL_SET, LCB_CNTL_FORCE_SASL_MECH, "PLAIN");

* [major] CCBC-286 libuv plugin: use same CRT for free/malloc

* [major] CCBC-288 Fail `NOT_MY_VBUCKET` responses on timeout

* [major] CCBC-275 Do a full purge when negotiation times out. In this
  case we must purge the server from all commands and not simply pop
  individual items.

* [major] CCBC-275 Reset the server's buffers upon reconnection. This
  fixes a crash experienced when requesting a new read with the
  previous buffer still in tact. This was exposed by calling
  `lcb_failout_server` on a timeout error while maintaining the same
  server struct.

* [major] CCBC-282 Make server buffers reentrant-safe. When purging
  implicit commands, we invoke callbacks which may in turn cause other
  LCB entry points to be invoked which can shift the contents and/or
  positions of the ringbuffers we're reading from.

* [major] CCBC-204, CCBC-205 Stricter/More inspectable behavior for
  config cache. This provides a test and an additional `lcb_cntl`
  operation to check the status of the configuration cache. Also it
  switches off config cache with memcached buckets.

      int is_loaded;
      lcb_cntl(instance, LCB_CNTL_GET, LCB_CNTL_CONFIG_CACHE_LOADED, &is_loaded);
      if (is_loaded) {
          printf("Configuration cache saved us a trip to the config server\n");
      } else {
          printf("We had to contact the configuration server for some reason\n");
      }

* [major] CCBC-278 Use common config retry mechanism for bad
  configcache. This uses the same error handling mechanism as when a
  bad configuration has been received from the network. New
  `LCB_CONFIG_CACHE_INVALID` error code to notify the user of such a
  situation

* [major] CCBC-274 Handle getl/unl when purging the server (thanks
  Robert Groenenberg)

* [major] Don't failout all commands on a timeout. Only fail those
  commands which are old enough to have timed out already.

* [major] CCBC-269 Don't record and use TTP/TTR from observe. Just
  poll at a fixed interval, as the responses from the server side can
  be unreliable.

* [minor] Allow hooks for mapping server codes to errors. This also
  helps handle sane behavior if a new error code is introduced, or
  allow user-defined logging when a specific error code is received.

      lcb_errmap_callback default_callback;

      lcb_error_t user_map_error(lcb_t instance, lcb_uint16_t in)
      {
        if (in == PROTOCOL_BINARY_RESPONSE_ETMPFAIL) {
          fprintf(stderr, "temporary failure on server\n");
        }
        return default_callback(instance, in);
      }

      ...

      default_callback = lcb_set_errmap_callback(conn, user_map_error);

* [minor] Add an example of a connection pool. See
  `example/instancepool` directory

* [minor] CCBC-279 Force `lcb_wait` return result of wait operation
  instead of `lcb_get_last_error`. It returns `last_error` if and only
  if the handle is not yet configured

* [minor] CCBC-284 `cbc-pillowfight`: compute item size correctly
  during set If `minSize` and `maxSize` are set to the same value it
  can sometimes crash since it may try to read out of memory bounds
  from the allocated data buffer.

* [minor] CCBC-283 Apply key prefix CLI option in cbc-pillowfight

* [minor] Add `--enable-maintainer-mode`. Maintainer mode enables
  `--enable-werror --enable-warnings --enable-debug`, forces all
  plugins to be installed and forces all tests, tools, and examples to
  be built

* [minor] CCBC-255 Expose `LCB_MAX_ERROR` to allow user-defined codes

## 2.1.3 (2013-09-10)

* [minor] Updated gtest to version 1.7.0. Fixes issue with building
  test suite with new XCode 5.0 version being released later this
  month.

* [major] CCBC-265 Do not try to parse config for `LCB_TYPE_CLUSTER`
  handles. It fixes timouts for management operations (like 'cbc
  bucket-create', 'cbc bucket-flush', 'cbc bucket-delete' and 'cbc
  admin')

* [major] CCBC-263 Skip unfinished SASL commands on rebalance. During
  rebalance, it is possible that the newly added server doesn't have
  chance to finish SASL auth before the cluster will push config
  update, in this case packet relocator messing cookies. Also the
  patch makes sure that SASL command/cookie isn't mixing with other
  commands

* [major] Use cluster type connection for cbc-bucket-flush. Although
  flush command is accessible for bucket type connections,
  cbc-bucket-flush doesn't use provided bucket name to connect to,
  therefore it will fail if the bucket name isn't "default".

* [major] Allow to make connect order deterministic. It allows the
  user to toggle between deterministic and random connect order for
  the supplied nodes list. By default it will randomize the list.

* [major] Do not allow to use Administrator account for
  `LCB_TYPE_BUCKET`

* [major] CCBC-258 Fig segmentation faults during tests load of
  node.js. Sets `inside_handler` on `socket_connected`. Previously we
  were always using SASL auth, and as such, we wouldn't flush packets
  from the `cmd_log` using `server_send_packets` (which calls
  `apply_want`). `apply_want` shouldn't be called more than once per
  event loop entry -- so this sets and unsets the `inside_handler`
  flag.

* [major] Added support of libuv 0.8

* [major] Close config connection before trying next node. It will fix
  asserts in case of the config node becomes unresponsive, and the
  threshold controlled by `LCB_CNTL_CONFERRTHRESH` and `lcb_cntl(3)`

## 2.1.2 (2013-08-27)

* [major] CCBC-253, CCBC-254 Use bucket name in SASL if username
  omitted. Without this fix, you can may encounter a segmentation
  faults for buckets, which are not protected by a password.

* [major] Preserve IO cookie in `options_from_info` when using v0
  plugins with user-provided IO loop instance. This issue was
  introduced in 2.1.0.

* [minor] Display the effective IO backend in 'cbc-version'. This is
  helpful to quickly detect what is the effective IO plugin on a given
  system.

## 2.1.1 (2013-08-22)

* [minor] Use provided credentials for authenticating to the data
  nodes. With this fix, it is no longer possible to use Administrator
  credentials with a bucket. If your configuration does so, you must
  change the credentials you use before applying this update. No
  documentation guides use of Administrator credentials, so this
  change is not expected to affect few, if any deployments.

* [major] CCBC-239 Do not use socket after failout. Fixes segmentation
  faults during rebalance.

* [minor] CCBC-245 Distribute debug information with release binaries
  on Windows

* [minor] CCBC-248 Do not disable config.h on UNIX-like platforms. It
  fixes build issue, when application is trying to include plugins
  from the tarball.

* [major] CCBC-192 Skip misconfigured nodes in the list. New
  lcb\_cntl(3couchbase) added to control whether the library will skip
  nodes in initial node list, which listen on configuration port (8091
  usually) but doesn't meet required parameters (invalid
  authentication or missing bucket). By default report this issue and
  stop trying nodes from the list, like all previous release. Read
  more at man page lcb\_cntl(3couchbase) in section
  LCB\_CNTL\_SKIP\_CONFIGURATION\_ERRORS\_ON\_CONNECT

* [major] CCBC-246 Fallback to 'select' IO plugin if default plugin
   cannot be loaded. On UNIX-like systems, default IO backend is
   'libevent', which uses third-party library might be not available
   at the run-time. Read in lcb\_cntl(3couchbase) man page in section
   LCB\_CNTL\_IOPS\_DEFAULT\_TYPES about how to determine effective IO
   plugin, when your code chose to use LCB\_IO\_OPS\_DEFAULT during
   connection instantiation. The fallback mode doesn't affect
   application which specify IO backend explicitly.

## 2.1.0 (2013-08-17)

* [major] New backend `select`. This backend is based on the select(2)
  system call and its Windows version. It could be considered the most
  portable solution and is available with the libcouchbase core.

* [major] CCBC-236 New backend `libuv`. This backend previously was
  part of the `couchnode` project and is now available as a plugin.
  Because libuv doesn't ship binary packages there is no binary
  package `libcouchbase2-libuv`. You can build plugin from the source
  distribution, or through the `libcouchbase-dev` or
  `libcouchbase-devel` package on UNIX like systems.

* [major] New backend `iocp`. This is a Windows specific backend,
  which uses "I/O Completion Ports". As a part of the change, a new
  version of plugin API was introduced which is more optimized to this
  model of asynchronous IO.

* [major] CCBC-229 Fixed bug when REPLICA\_FIRST fails if first try
  does not return key

* [major] CCBC-228 Fixed bug when REPLICA\_SELECT didn't invoke
  callbacks for negative error codes

* [major] CCBC-145 API for durability operations. This new API is
  based on `lcb_observe(3)` and allows you to monitor keys more
  easily. See the man pages `lcb_durability_poll(3)` and
  `lcb_set_durability_callback(3)` for more info.

* [major] New configuration interface lcb\_cntl(3) along with new
  tunable options of the library and connection instances. In this
  release the following settings are available. See the man page for
  more information and examples.:

  * LCB\_CNTL\_OP\_TIMEOUT operation timeout (default 2.5 seconds)

  * LCB\_CNTL\_CONFIGURATION\_TIMEOUT time to fetch cluster
    configuration. This is similar to a connection timeout (default 5
    seconds)

  * LCB\_CNTL\_VIEW\_TIMEOUT timeout for couchbase views (default 75
    seconds)

  * LCB\_CNTL\_HTTP\_TIMEOUT timeout for other HTTP operations like
    RESTful flush, bucket creating etc. (default 75 seconds)

  * LCB\_CNTL\_RBUFSIZE size of the internal read buffer (default
    32768 bytes)

  * LCB\_CNTL\_WBUFSIZE size of the internal write buffer (default
    32768 bytes)

  * LCB\_CNTL\_HANDLETYPE type of the `lcb\_t` handler (readonly)

  * LCB\_CNTL\_VBCONFIG returns pointer to VBUCKET\_CONFIG\_HANDLE
    (readonly)

  * LCB\_CNTL\_IOPS get the implementation of IO (lcb\_io\_opt\_t)

  * LCB\_CNTL\_VBMAP get vBucket ID for a given key

  * LCB\_CNTL\_MEMDNODE\_INFO get memcached node info

  * LCB\_CNTL\_CONFIGNODE\_INFO get config node info

  * LCB\_CNTL\_SYNCMODE control synchronous behaviour (default
    LCB\_ASYNCHRONOUS)

  * LCB\_CNTL\_IP6POLICY specify IPv4/IPv6 policy (default
    LCB\_IPV6\_DISABLED)

  * LCB\_CNTL\_CONFERRTHRESH control configuration error threshold
    (default 100)

  * LCB\_CNTL\_DURABILITY\_TIMEOUT durability timeout (default 5 seconds)

  * LCB\_CNTL\_DURABILITY\_INTERVAL durability polling interval (default
    100 milliseconds)

  * LCB\_CNTL\_IOPS\_DEFAULT\_TYPES get the default IO types

  * LCB\_CNTL\_IOPS\_DLOPEN\_DEBUG control verbose printing of dynamic
    loading of IO plugins.

## 2.0.7 (2013-07-10)

* [major] CCBC-183 Improve `lcb_get_replica()`. Now it is possible
  to choose between three strategies:

  1. `LCB_REPLICA_FIRST`: Previously accessible and now the default,
     the caller will get a reply from the first replica to successfully
     reply within the timeout for the operation or will receive an
     error.

  2. `LCB_REPLICA_ALL`: Ask all replicas to send documents/items
     back.

  3. `LCB_REPLICA_SELECT`: Select one replica by the index in the
     configuration starting from zero. This approach can more quickly
     receive all possible replies for a given topology, but it can
     also generate false negatives.

  Note that applications should not assume the order of the
  replicas indicates more recent data is at a lower index number.
  It is up to the application to determine which version of a
  document/item it may wish to use in the case of retrieving data
  from a replica.

## 2.0.6 (2013-05-07)

* [major] CCBC-188 Fix segfault when rebalancing
  When a (!connected) server is reconnected, the tasks in its
  "pending" buffer will be moved into "output" buffer. If its
  connection is broken again immediately, relocate_packets() will go
  to wrong path.

* [major] CCBC-202 Don't try to switch to backup nodes when timeout is
  reached

* [major] CCBC-188 Check if SASL struct is valid before disposing

* [major] Fix compile error with sun studio
  "src/event.c", line 172: error: statement not reached (E_STATEMENT_NOT_REACHED)

* [major] Don't invoke HTTP callbacks after cancellation, because
  user code might assume a previously-freed resource is still valid

* [minor] CCBC-179 Added an example to properly use the bucket
  credentials for authentication instead of administrator credentials

* [minor] example/yajl/couchview.c: pass cookie to the command
  Fixes coredump when executing ./examples/yajl/couchview

* [minor] CCBC-201 Add Host header in http request
  http://cbugg.hq.couchbase.com/bug/bug-555 points out that Host is a
  required field in HTTP 1.1

## 2.0.5 (2013-04-05)

* [minor] Try to search the --libdir for modules if dlopen
  fails to find the module in the default library path

* [minor] CCBC-190 New compat mode (experimental) for configuration
  caching. See man lcb_create_compat

* [minor] Manpage fixes

* [minor] Fix build on FreeBSD (http://review.couchbase.org/25289)

* [minor] Fix reconnecting issues on windows
  (http://review.couchbase.org/25170 and
   http://review.couchbase.org/25155)

* [minor] pillowfight example updated to optionally use threads

## 2.0.4 (2013-03-06)

* [minor] CCBC-185 The bootstrap URI is not parsed correctly

* [minor] CCBC-175 Work properly on systems where EWOULDBLOCK != EAGAIN

* [critical] CCBC-180 Segmentation fault when the hostname resolved
  into several addresses and first of them reject couchbase
  connections.

* [major] CCBC-182 The library stops iterating backup nodes list if
  the next one isn't accessible.

* [major] CCBC-147 Fixed illegal memory access in win32 plugin

* [minor] CCBC-178 Build error on solaris/sparc: -Werror=cast-align

## 2.0.3 (2013-02-06)

* [minor] bypass SASL LIST MECH

* [minor] Shrink internal lookup tables (and reduce the size of
  lcb_t)

* [minor] Add a new library: libcouchbase_debug.so (see
  include/libcouchbase/debug.h) which is a new library that contains
  new debug functionality.

* [minor] Added manual pages for the library

* [major] CCBC-153 Reset internal state on lcb_connect(). Allow caller
  to use lcb_connect() multiple times to implement reconnecting using
  the same lcb_t instance. Also it sets up the initial-connection
  timer for users who don't use lcb_wait() and drive IO loop manually.

* [major] CCBC-171 Invalid read in libevent plugin, when the plugin
  compiled in 1.x mode

* [critical] CCBC-155 Observe malfunctions in the case of multiple
  keys and server failure

* [major] CCBC-156 The ep-engine renders meaningful body for observe
  responses only if status code is 0 (PROTOCOL_BINARY_RESPONSE_SUCCESS).
  We shouldn't interpret response body in other cases, just decode &
  failout request instead. Also we shouldn't retry observe commands on
  PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET, because it can cause the
  client to loop infinitely

* [major] CCBC-145 KV Durability operation API. Async APIs added to
  allow the checking of the durability (replication and persistence)
  status of a key, and to notify the user when a specific criteria has
  been satisfied.

## 2.0.2 (2013-01-04)

* [major] CCBC-150 commands sent to multiple servers fail to detect
  the respose if mixed with other commands.

* [minor] CCBC-143 'cbc version' reports that uses 2.0.0, but really
  installed with 2.0.1. Minor but confusing issue.

* [major] CCBC-151 Cancellation of the HTTP request might lead to
  memory leaks or to segfaults (2e3875c2).

* [minor] Document LCB_SERVER_BUG and LCB_PLUGIN_VERSION_MISMATCH.
  Enhance the the lcb_strerror test to detect undocumented error
  codes.

* [critical] CCBC-153 Under high load the library could generate
  LCB_ETIMEDOUT errors without reason owing to internal limitations.

## 2.0.1 (2012-12-11)

50 files changed, 1009 insertions(+), 274 deletions(-)

* libev-plugin: delay all timers while the loop isn't active. It will
  fix LCB_ETIMEOUT in the following scenario:

  * connect the instance
  * sleep for time greater than default timeout (e.g. 3 seconds)
  * schedule and execute a command (it will be timed out
    immediately)

* libev-plugin: reset IO event on delete. We need to reset it,
  because it might be re-used later

* CCBC-136: do not abort when purging SASL commands

* Make library C89 friendly again

* CCBC-132, CCBC-133: Ensure HTTP works even when the network may be
  unreliable. This changeset encompasses several issues which had been
  found with HTTP requests during network errors and configuration
  changes. Specifically some duplicate code paths were removed, and
  the process for delivering an HTTP response back to the user is more
  streamlined.

* CCBC-130: Fix a memory leak on the use of http headers

* CCBC-131: Compensate for cluster nodes lacking couchApiBase

* Fix possible SEGFAULT. Not-periodic timers are destroyed after
  calling user's callback, after that library performed read from
  freed pointer.

* SystemTap and DTrace integration

## 2.0.0 (2012-11-27)

12 files changed, 50 insertions(+), 12 deletions(-)

* Install unlock callback in synchronous mode

* Add the CAS to the delete callback

* Minor update of the packaging layout:

  * libcouchbase-all package comes without version
  * extract debug symbols from libcouchbase-{bin,core} to
    libcouchbase-dbg package

## 2.0.0beta3 (2012-11-21)

64 files changed, 3641 insertions(+), 735 deletions(-)

* CCBC-104 Fix illegal memory access. Reconnect config listener if the
  config connection was gone without proper shutdown.

* Check for EWOULDBLOCK/EINTR on failed send

* Allow to use gethrtime() from C++

* Fix using freed memory (was introduced in 4397181)

* Use dynamic versioning for plugins

* Remove libtool version from the plugins

* Allow to use 'cbc-hash' with files

* CCBC-120 Purge stale OBSERVE packets

* CCBC-120 Reformat and refactor lcb_server_purge_implicit_responses:

  * move packet allocation out of GET handler
  * dropping NOOP command shouldn't return error code

* CCBC-122 Try to switch another server from backup list on timeout

* CCBC-119: Allow the user to specify a different hash key. All of the
  data operations contains a hashkey and nhashkey field. This allows
  you to "group" items together in your cluster. A typical use case
  for this is if you're storing lets say data for a single user in
  multiple objects. If you want to ensure that either all or none of
  the objects are available if a server goes down, it could be a good
  idea to locate them on the same server. Do bear in mind that if you
  do try to decide where objects is located, you may end up with an
  uneven distribution of the number of items on each node. This will
  again result in some nodes being more busy than others etc. This is
  why some clients doesn't allow you to do this, so bear in mind that
  by doing so you might not be able to get your objects from other
  clients.

* Create man pages for cbc and cbcrc

* CCBC-118 lcb_error_t member in the http callbacks shouldn't reflect
  the HTTP response code. So the error code will be always LCB_SUCCESS
  if the library managed to receive the data successfully.

* Timer in libev uses double for interval. Ref:
  http://pod.tst.eu/http://cvs.schmorp.de/libev/ev.pod#code_ev_timer_code_relative_and_opti

* CCBC-115 Return zero from do_read_data() if operations_per_call
  reached. The `operations_per_call' limit was introduced to prevent
  from freezing event loop. But in the function variable rv could
  store two different results and in case of reaching this limit it is
  returning number of the processed records, which is wrong. The
  function should return either zero (success) or non-zero (failure).

* Do not allow admin operations without authentication

* Fix cbc-bucket-create. `sasl-password' is misspelled, and it fails
  to parse the command line option.

* CCBC-114 Lookup the plugin symbol also in the current executable
  image.

* CCBC-113 Remove unauthorized asserion (d344037). The
  lcb_server_send_packets() function later check if the server object
  connected and establish connection if not (with raising possible
  errors)

* Try all known plugins for LCB_IO_OPS_DEFAULT in run time

* Don't use the time_t for win32. When compiling from php it turns out
  that it gets another size of the time_t type, causing the struct
  offsets to differ.

* Add lcb_verify_compiler_setup(). This function allows the "user" of
  the library to verify that the compiler use a compatible struct
  packing scheme.

* CCBC-87: Add documentation about the error codes

## 2.0.0beta2 (2012-10-12)

81 files changed, 2822 insertions(+), 1353 deletions(-)

* Search ev.h also in ${includedir}/libev

* Fix SEGFAULT if IO struct is allocated not by the lcb_create()

* Allow libcouchbase to connect to an instance without specifying bucket. It is useful
  when the bucket not needed, e.g. when performing administration
  tasks.

* Fix memory leak after an unsuccessful connection

* Fix invalid memory access in cbc tool. Affected command is
  cbc-bucket-create

* lcb_create: replace assert() with error code

* CCBC-105 breakout event loop in default error_callback. This provides
  better default behaviour for users who haven't defined global error
  callback.

* Allow users to build the library without dependencies. For example,
  without plugins at all. This may be useful if the plugin is
  implemented by or built into the host application.

* Allow users to install both libraries (2.x and 1.x) on the same system.

* Make the content type optional for lcb_make_http_request()

* Fix password memory leak in http.c (7e71493)

* Add support for raw http requests. libcouchase already contains all
  the bits to execute a raw http request, except for the possibility
  to specify a host:port, username and password.

* Cleanup HTTP callbacks. Use the same callbacks both for Management
  and View commands, and rename them to lcb_http_complete_callback and
  lcb_http_data_callback.

* Allow users to use environment variables to pick the event plugin

* Add a new interface version for creating IO objects via plugins

* Implement a new libev plugin. It is compatible with both libev3 and
  libev4.

* CCBC-103: Fix linked event/timer lists for win32

* Allow to disable CXX targets

* lcb_connect() should honor the syncmode setting. Automatically call
  lcb_wait() when in synchronous mode

## 2.0.0beta (2012-09-13)

123 files changed, 13753 insertions(+), 8264 deletions(-)

* Refactor the API. This is a full redesign of the current
  libcouchbase API that'll allow us to extend parts of the API without
  breaking binary compatibility. Also it renames all functions to have
  lcb_ prefix instead of libcouchbase_ and LCB/LIBCOUCHBASE in macros.

* Added --enable-fat-binary. Helps to solve issues when linking with
  fat binaries on MacOS.

* Implement getter for number of nodes in the cluster:
  lcb_get_num_nodes()

* Implement RESTful flush in the cbc toolset

* Bundle Windows packages as zip archives

* CCBC-98 Differentiate between TMPFAILs. This allows a developer
  to know if the temporary condition where the request cannot be
  handled is due to a constraint on the client or the server.

* Don't try to put the current node last in the backup list. This may
  cause "duplicates" in the list if the REST server returns another
  name for the server than you used.  Ex: you specify "localhost" and
  the REST response contains 127.0.0.1

* Fix locking keys in multi-get mode

* Fix bug where HTTP method is not set

* CCBC-96 Correct buffer length for POST/PUT headers

* Add lcb_get_server_list

* Merge lcb_get_locked into lcb_get function

* Fix Windows build

* Include sys/uio.h. Needed by OpenBSD

* Fix mingw build (c394a1c)

* CCBC-80: Default to IPv4 only

* Sync memcached/protocol_binary.h. Pull extra
  protocol_binary_datatypes declarations.

* Deliver HTTP headers via callbacks

* Unify HTTP interface. This means massive rename of the symbols

* CCBC-92 release ringbuffer in lcb_purge_single_server

* CCBC-91 Fix switching to backup node in case of server outage

* CCBC-91 Reset timer for commands with NOT_MY_VBUCKET response

* Fix alignment for sparc platforms

* Fix win32 build (Add strings.h)

* Fix build with libyajl available

* Bundle libvbucket

* Fix a problem with allocating too few slots in the backup_nodes. Fixes
  illegal memory access.

* CCBC-90 Fix initialization of backup nodes array. The code switching
  nodes relies on NULL terminator rather than nbackup_nodes variable.
  Fixes illegal memory access.

* CCBC-89: Release the memory allocated by the http parser

## 1.0.6 (2012-08-30)

5 files changed, 18 insertions(+), 5 deletions(-)

* CCBC-92 release ringbuffer in libcouchbase_purge_single_server

## 1.0.5 (2012-08-15)

6 files changed, 23 insertions(+), 15 deletions(-)

* CCBC-91 Fix switching to backup node in case of server outage

* CCBC-91 Reset timer for commands with NOT_MY_VBUCKET response

## 1.1.0dp9 (2012-07-27)

5 files changed, 18 insertions(+), 11 deletions(-)

* Render auth credentials for View requests.
  libcouchbase_make_http_request() won't accept credentials anymore.
  It will pick them bucket configuration.

## 1.1.0dp8 (2012-07-27)

36 files changed, 2093 insertions(+), 704 deletions(-)

* Allow the client to specify the verbosity level on the servers using
  lcb_set_verbosity() function.

* Bind timeouts to server sockets instead of commands. This means that
  from this point timeout interval will be started from the latest IO
  activity on the socket. This is a behavior change from the 1.0 series.

* Allow the user to get the number of replicas using
  libcouchbase_get_num_replicas()

* Allow a user to breakout from the event loop in callbacks using
  libcouchbase_breakout()

* Make libcouchbase_wait() re-entrable

* Let users detect if the event loop running already using
  libcouchbase_is_waiting() function.

* CCBC-77 Use separate error code for ENOMEM on the client

* CCBC-82 Implement read replica

* CCBC-85 Implement general purpose timers. It is possible for users
  to define their own timers using libcouchbase_timer_create()
  function. (See headers for more info)

* Implement multiple timers for windows

* CCBC-15 Add OBSERVE command

* Allow users to specify content type for HTTP request

* Fix to handle the case when View base doesn't have URI schema

* Separate HTTP callbacks for couch and management requests

* Claim that server has data in buffers if there are HTTP requests
  pending. Without this patch the event loop can be stopped
  prematurely.

* Add new cbc commands and options:

  * cbc-view (remove couchview example)
  * cbc-verbosity
  * cbc-admin
  * cbc-bucket-delete
  * cbc-bucket-create
  * Add -p and -r options to cbc-cp to control persistence (uses
    OBSERVE internally)

## 1.1.0dp7 (2012-06-19)

18 files changed, 266 insertions(+), 115 deletions(-)

* Add support for notification callbacks for configuration changes.
  Now it is possible to install a hook using function
  libcouchbase_set_configuration_callback(), and be notified about all
  configuration changes.

* Implement function to execution management requests. Using
  libcouchbase_make_management_request() function you can configure
  the cluster, add/remove buckets, rebalance etc. It behaves like
  libcouchbase_make_couch_request() but works with another endpoint.

* Extract HTTP client. Backward incompatible change in Couchbase View
  subsystem

## 1.1.0dp6 (2012-06-13)

20 files changed, 201 insertions(+), 127 deletions(-)

* CCBC-70 Close dynamic libraries. Fixes small memory leak

* CCBC-72 Fix compilation on macosx with gtest from homebrew

* CCBC-71 Implement 'help' command for cbc tool

* Undefine NDEBUG to avoid asserts to be optimized out

* Fix win32 builds:

  * Add suffix to cbc command implementations
  * Fix guards for socket errno macros
  * Define size_t types to fix MSVC 9 build
  * MSVC 9 isn't C99, but has stddef.h, so just include it

* CCBC-63 Include types definitions for POSIX systems. Fixes C++
  builds on some systems.

## 1.1.0dp5 (2012-06-06)

7 files changed, 65 insertions(+), 9 deletions(-)

* The library doesn't depend on pthreads (eliminates package lint
  warnings)

* Implement 'cbc-hash' to match server/vbucket for given key

## 1.1.0dp4 (2012-06-05)

8 files changed, 54 insertions(+), 7 deletions(-)

* cbc: strtoull doesn't exist on win32, therefore use C++ equivalent.

* integration with Travis-CI

## 1.1.0dp3 (2012-06-03)

54 files changed, 1874 insertions(+), 824 deletions(-)

* CCBC-68 Implement UNLOCK_KEY (UNL) command

* CCBC-68 Implement GET_LOCKED (GETL) command

* hashset.c: iterate over whole set on rehashing. Fixes memory leaks
  related to hash collisions (905ef95)

* Destroy view requests items when server get destroyed

* Do not call View callbacks for cancelled requests

* Fix ringbuffer_memcpy() (36afdb2)

* CCBC-62 A hang could occur in libcouchbase_wait() after the timeout
  period. Check for breakout condition after purging servers

* CCBC-65 A small memory leak can occur with frequent calls to
  libcouchbase_create() and libcouchbase_destroy()

* CCBC-64. Timeouts can occur during topology changes, rather than be
  correctly retried. Send the retry-packet to new server

* vbucket_found_incorrect_master() returns server index

* Fix ringbuffer_is_continous()

* Pick up cookies from pending buffer unless node connected

* RCBC-33 A fix for a buffer overflow with the supplied password as
  has been integrated. While it is a buffer overflow issue, this is
  not considered to be a possible security issue because the password
  to the bucket is not commonly supplied by an untrusted source

## 1.0.4 (2012-06-01)

15 files changed, 330 insertions(+), 76 deletions(-)

* CCBC-65 A small memory leak can occur with frequent calls to
  libcouchbase_create() and libcouchbase_destroy()

* CCBC-62 A hang could occur in libcouchbase_wait() after the timeout
  period. Check for breakout condition after purging servers

* CCBC-64. Timeouts can occur during topology changes, rather than be
  correctly retried. Send the retry-packet to new server

* [backport] vbucket_found_incorrect_master() returns server index.
  (orig: c32fdae)

## 1.0.3 (2012-05-02)

6 files changed, 44 insertions(+), 7 deletions(-)

* [backport] Fix ringbuffer_is_continous() (orig: 9cfda9d)

* [backport] Pick up cookies from pending buffer unless node connected
  (orig: 463958d)

* RCBC-33 A fix for a buffer overflow with the supplied password as
  has been integrated. While it is a buffer overflow issue, this is
  not considered to be a possible security issue because the password
  to the bucket is not commonly supplied by an untrusted source

## 1.1.0dp2 (2012-04-10)

10 files changed, 54 insertions(+), 20 deletions(-)

* CCBC-59 Don't wait for empty buffers. If called with no operations
  queued, libcouchbase_wait() will block forever. This means that a
  single threaded application that calls libcouchbase_wait() at
  different times to make sure operations are sent to the server runs
  the risk of stalling indefinitely. This is a very likely scenario.

* Don't define size_t and ssize_t for VS2008

* Fix segfault while authorizing on protected buckets (211bb04)

## 1.1.0dp (2012-04-05)

59 files changed, 4374 insertions(+), 1205 deletions(-)

* This release adds new functionality to directly access Couchbase
  Server views using the libcouchbase_make_couch_request() function.
  See the associated documentation and header files for more details

* Check for newer libvbucket

* MB-4834: Request the tap bytes in a known byte order (adf2b30)

## 1.0.2 (2012-03-06)

83 files changed, 4095 insertions(+), 654 deletions(-)

* Implement VERSION command from binary protocol

* Allow use of libcouchbase to pure memcached clusters by using
  libcouchbase_create_compat() function

* Always sign deb packages and allow to pass PGP key

* Bundle the protocol definitions for memcached
  (memcached/protocol_binary.h and memcached/vbucket.h) to make it
  easier to build

* Bundle sasl client implementation

* Fix windows build for MS Visual Studio 9

  * define E* if missing
  * stdint header

* Add support for multiple hosts for the bootstrap URL. A list of
  hosts:port separated by ';' to the administration port of the
  couchbase cluster. (ex: "host1;host2:9000;host3" would try to
  connect to host1 on port 8091, if that fails it'll connect to host2
  on port 9000 etc)

* Raise error if <stdint.h> missing

* Add JSON support for cbc-cp command

* Add option to set timeout for cbc

* Added support for '-' to cp

* Added cbc-verify: verify content in cache with files

* Now cbc supports better usage messages

## 1.0.1 (2012-02-13)

65 files changed, 3275 insertions(+), 1329 deletions(-)

* CCBC-38 Use alternate nodes when current is dead. A fix to allow the
  client library to failover automatically to other nodes when the
  initial bootstrap node becomes unavailable has been added. All users
  are recommended to upgrade for this fix.

* Fix connect timeouts. Timeouts are per-operation and only set if
  there is any I/O. The special exception to this is initial
  connections, which do not necessarily have a data stream or write
  buffer associated wiht them yet.

* Update to new MT-safe libvbucket API

* Add option for embedding libevent IO plugin

* Fix multi-{get,touch} requests handling when nkeys > 1

* Allow to build without tools which require C++ compiler

* Destroy event base if we created it

* CCBC-51 Check server index before using

* Handle PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET and retry it until
  success or another error, which can be handled by caller

* Do not attempt SASL when SASL already in progress

* Finer grained error reporting for basic REST errors:

  * return LIBCOUCHBASE_AUTH_ERROR on HTTP 401
  * return LIBCOUCHBASE_BUCKET_ENOENT on HTTP 404
  * event loop is stopped (via maybe_breakout) on REST error

* Fixed segfaults and memory access errors on libevent1.4

* Allow for notification on initial vbucket config. This makes
  libcouchbase stop_event_loop and libcouchbase maybe breakout work
  properly in cooperative asynchronous event loops. the wait flag is
  set by libcouchbase_wait() and unset by maybe_breakout.
  Additionally, breakout_vbucket_state_listener will call
  maybe_breakout as well, instead of having synchronous behavior
  assumed by libcouchbase_wait()

* Fix sasl_list_mech_response_handler(). sasl_client_start() expects
  null-terminated string

* Refactor: use libcouchbase_xxxx for the datatypes

* Do not notify user about the same error twice. Use command callback
  when it's possible. (e.g. where the libcouchbase_server_t is
  accessible and we can libcouchbase_failout_server())

* Install configuration.h for win32

* CCBC-20 Implement operation timeouts. Timeouts applies for all
  operations, and the timer starts running from the moment you call
  the libcouchbase operation you want. The timer includes times for
  connect/send/ receive, and all of the time our application spend
  before letting the event loop call callbacks into libcouchbase.

* Fix double free() error when reading key from packet in handler.c
  (b5d485a)

## 1.0.0 (2012-01-22)

170 files changed, 6048 insertions(+), 7553 deletions(-)

* Allow the user to specify sync mode on an instance

* Empty string as bucket name should be treated as NULL

* Bail out if you can't find memcached/vbucket.h and
  libvbucket/vbucket.h

* New command cbc. This command intended as the analog of mem*
  tools from libmemcached distribution. Supported commands:

  * cbc-cat
  * cbc-cp
  * cbc-create
  * cbc-flush
  * cbc-rm
  * cbc-stats
  * cbc-send
  * cbc-receive

* CCBC-37 allow config for cbc tool to be read from .cbcrc

* Convert flags to network byte order

* Remove <memcached/vbucket.h> dependency

* Use the error handler instead of printing to stderr

* Disable Views code

* Don't accept NULL as a valid "callback"

* Add make targets to build RPM and DEB packages

* Allow download memcached headers from remote host

* Added docbook-based manual pages

* Gracefully update vbucket configuration. This means that the
  connection listener, could reconfigure data sockets on the fly

* Allow libcouchbase build with libevent 1.x (verified for 1.4.14)

* Aggregate flush responses

* Add stats command

## 0.3.0 (2011-11-02)

102 files changed, 6188 insertions(+), 1531 deletions(-)

* Add flush command from binary protocol

* Remove packet filter

* Use ringbuffers instead buffer_t

* Win32 build fixes

* Allow to specify IO framework but using IO plugins

* CCBC-11 The interface to access views

* Initial man pages

* Extend the test suite

## 0.2.0 (2011-09-01)

85 files changed, 12144 insertions(+)

* Simple bootstapping which builds HTTP packet and listens
  /pools/default/buckets/BUCKETNAME directly. Allowed usage of
  defaults (bucket name, password)

* Support basic set of binary protocol commands:

  * get (get and touch)
  * set
  * increment/decrement
  * remove
  * touch

* MB-3294 Added `_by_key' functions

* CCBC-5 Fixed abort in do_read_data (c=0x7b09bf0) at src/event.c:105

* Added timings API. It might be possible to turn on timing collection
  using libcouchbase_enable_timings()/libcouchbase_disable_timings(),
  and receive the data in timings callback.

* Basic TAP protocol implementation

* Initial win32 support
