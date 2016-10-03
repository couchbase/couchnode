# Release Notes

## 2.6.3 (September 27 2016)

* Fix memory corruption for some JSON APIs when no rows are returned.
  This fixes a bug where the JSON parser would read from garbage memory when
  parsing a response that had no rows, but due to a slow network, would be
  received in multiple chunks.
  This affects N1QL, CBFT, and View APIs.
  * Priority: Major
  * Issues: [CCBC-721](https://issues.couchbase.com/browse/CCBC-721)

* Allow to adjust bytes to read per event loop iteration.
  This allows applications with high network throughput but low CPU capacity
  to prevent the library from oversaturating a specific event callback invocation
  or starve other sockets. It may be controlled through the `read_chunk_size`
  connection string option or via `lcb_cntl_string`.
  * Priority: Major
  * Issues: [CCBC-568](https://issues.couchbase.com/browse/CCBC-568)

* Use `htonll` for CAS values.
  This allows a consistent representation of CAS values regardless of underlying
  platform. This allows interoperability between other SDKs with respect to
  exchanging CAS values. This however may break interoperability with older
  versions of the same SDK, if the CAS value is being passed around (which it
  shouldn't be).

* New subdocument additions.
  This adds the `LCB_SUBDOC_F_MKDOCUMENT` flag which allows document creation
  if the document does not exist, and can be used for mutation operations which
  may create new paths or values. The `LCB_SUBDOC_CMD_GET_COUNT` is also added,
  which is a new command which retrieves the number of elements (for an array)
  or key-value items (within an object/dictionary) of a given path.
  Both these features require Couchbase Server 4.6 (or its prereleases).
  * Priority: Major
  * Issues: [CCBC-718](https://issues.couchbase.com/browse/CCBC-718)

## 2.6.2 (July 26 2016)

* Don't crash on high number of FDs with select plugin. Because `select(2)`
  can only accomodate up to a certain number of file descriptors in the
  application, if opening a socket results in a too-high-numbered FD, the
  plugin will return an error rather than silently failing during polling.
  * Priority: Major
  * Issues: [CCBC-567](https://issues.couchbase.com/browse/CCBC-567)

* Pillowfight can now set ttl (expiry). This is done via the `-e` or `--expiry`
  option.
  * Priority: Major
  * Issues: [CCBC-637](https://issues.couchbase.com/browse/CCBC-637)

* Log URLs of HTTP requests. This may make it easier to debug some HTTP-based
  APIs. The URLs are printed as part of the `TRACE` logging level.
  * Priority: Major
  * Issues: [CCBC-641](https://issues.couchbase.com/browse/CCBC-641)

* Fix crash on shutdown with completion-based I/O. The crash was a result
  of dereferencing the `lcb_t` after it had been destroyed. This bug affected
  completion-based I/O subsystems such as libuv and IOCP.
  * Priority: Major
  * Issues: [CCBC-707](https://issues.couchbase.com/browse/CCBC-707)

* Do not require `operation` field to be set on `lcb_CMDSTORE`.
  Starting from this version, a new `lcb_storage_t` constant, `LCB_UPSERT`
  has been added with a value of 0. This means that upsert operations no
  longer need to explicitly use `LCB_SET`, it being the default.
  * Priority: Major
  * Issues: [CCBC-545](https://issues.couchbase.com/browse/CCBC-545)

## 2.6.1 (June 21 2016)

* Index management API now properly handles 'fields' field. Previously this
  was treated as a csv string, when it is in fact a JSON array.

* `pillowfight` now has a `--populate-only` option, which is useful when simply
  trying to populate buckets with large amounts of data.

* Allow to bypass OpenSSL initialization. This allows applications which already
  have OpenSSL intialization code in place to suppress libcouchbase's own
  OpenSSL initialization code. You can disable SSL initialization by using
  `ssl=no_global_init` in the connection string.

* Allow to toggle sending of multiple credentials in N1QL queries.
  You can use the `LCB_CMD_F_MULTIAUTH` in the `lcb_CMDN1QL::cmdflags` field
  to indicate that multiple credentials should be added. Otherwise only the
  current bucket's credentials will be sent.

* Fix infinite loop on completion (UV,nodejs,IOCP) type IO plugins.
  This bug would be triggered when only a single server remained in the cluster
  and that single server failed. This would result in the client never being
  able to perform operations due to a delayed reference count decrement.
  * Priority: Major
  * Issues: [CCBC-704](https://issues.couchbase.com/browse/CCBC-704)

## 2.6.0 (May 17 2016)

* Improve index management API and implementation. The `rawjson` field was
  being ignored and the `condition` field was missing as well.

* Add pillowfight support for subdoc. At the simplest level you can simply
  invoke pillowfight as `cbc-pillowfight --subdoc --json <other args>`.
  Refer to the pillowfight documentation for more details.

## 2.5.8 (April 19 2016)

* Fix SSL connectivity errors with views and HTTP bootstrapping.
  This would cause network connectivity issues when attempting to bootstrap
  via `https://` or using views (`lcb_view_query()`). The fix is a workaround
  to not advertise older SSL encryption methods.
  * Priority: Major
  * Issues: [CCBC-688](https://issues.couchbase.com/browse/CCBC-688)

* Do not abort when receiving a memcached EINVAL response.
  While the client should never end up in a situation where it receives an
  `EINVAL` from the server, it should nevertheless not terminate the execution
  of the current process. This bug was introduced in 2.5.6
  * Issues: [CCBC-689](https://issues.couchbase.com/browse/CCBC-689)

* Fix memory leak when using N1QL prepared statements.
  Prepared statements would never be freed, even when the client handle was
  destroyed (`lcb_destroy()`) causing a slight memory leak.

* Append CRLF header after host header.
  This would sometimes result in odd HTTP headers being sent out.
  * Issues: [CCBC-694](https://issues.couchbase.com/browse/CCBC-694)

* Experimental CBFT (Full-Text search API)
  This version adds a new fulltext api. The API is a row-based API similar
  to N1QL and MapReduce. See the `<libcouchbase/cbft.h>` header for more details.
  The API is experimental and subject to change.
  * Issues: [CCBC-638](https://issues.couchbase.com/browse/CCBC-638)

* Allow additional client identifier for HELLO command.
  The SDK sends a version string to the server when doing initial negotiation.
  The server then uses this string in the context of any logging messages
  pertaining to that connection. In this version, a new setting has been added
  to allow 'user-defined' version strings to be appended to the logs. Note that
  this feature is intended only for use with wrapping SDKs such as Python, node.js
  and PHP so that their versions can be present in the log messages as well.
  This setting is exposed as a string control (in the connection string, or
  `lcb_cntl_string()` with the name of `client_string`.
  * Issues: [CCBC-693](https://issues.couchbase.com/browse/CCBC-693)

* vBucket retry logic changes.
  The client will now retry at constant 100ms rate when receiving not-my-vbucket
  error replies from the server (adjustable using `retry_nmv_interval`).
  It will also only use fast-forward map to determine the new location for the
  vbucket, and will not use extended hueristics.

  The most noteworthy user-visible change is the 100ms retry interval which
  will significantly decrease the network traffic used by the SDK
  during a rebalance.

  To restore the pre-2.5.8 behavior (i.e. use extended heuristics and and
  exponential retry rate), specify `vb_noguess=false`.
  * Priority: Major
  * Issues: [CCBC-660](https://issues.couchbase.com/browse/CCBC-660)

* Add interface for multi-bucket authentication.
  A new API has been added to modify and add additional bucket/password
  pairs in the library. This is done using `lcb_cntl` and the `LCB_CNTL_BUCKET_CRED`
  setting.

  Note that this functionality is not yet used in N1QL queries due to
  [MB-16964](https://issues.couchbase.com/browse/MB-16964)
  * Priority: Minor
  * Issues: [CCBC-661](https://issues.couchbase.com/browse/CCBC-661)


## 2.5.7 (March 22 2016)

* High-level index management operations.
  A volatile API for high level index management operations has been added to
  assist in common N1QL index operations such as creating the primary index
  and removing indexes.
  * Priority: Major
  * Issues: [CCBC-662](https://issues.couchbase.com/browse/CCBC-662)

* Fix N1QL mutation token queries.
  This fixes some bugs in the previous implementation of the way mutation tokens
  were handled with `lcb_N1QLPARAMS`. The bugs and fixes only affect consumers
  of that API. Couchbase SDKs do not consume this API
  * Priority: Minor
  * Issues: [CCBC-658](https://issues.couchbase.com/browse/CCBC-658)

* Throttle config request retries on empty NMVB responses.
  This changes the previous behavior where a new configuration would be
  retrieved _immediately_ upon a not-my-vbucket reply if a configuration
  was not included within the error reply itself. The new behavior is to
  request a delayed retry (i.e. subject to the default throttle settings)
  if the current configuration originated from the CCCP (Memcached) provider.
  * Priority: Major
  * Issues: [CCBC-681](https://issues.couchbase.com/browse/CCBC-681)

* Rename `LCB_CLIENT_ETMPFAIL` to `LCB_CLIENT_ENOCONF`.
  This error code is returned only when there is no current client configuration.
  This error condition is _not_ temporary and is actually fatal; a result of
  an initial bootstrapping failure. Note that the older name is still valid
  in older code for compatibility purposes.
  * Priority: Minor
  * Issues: [CCBC-679](https://issues.couchbase.com/browse/CCBC-679)

* Include PID in log messages on OS X.
  This makes the library logs (via `LCB_LOGLEVEL` etc.) easier to read on a
  mac. Previously this used to display only the thread ID, which was identical
  for multiple processes. Now the display reads as _pid/tid_, making it easier
  to read the logs in a multi-process environment.
  * Priority: Minor
  * Issues: [CCBC-677](https://issues.couchbase.com/browse/CCBC-677)


## 2.5.6 (February 18 2016)

* Sub-Document API (_experimental_)
  The client-side sub-document API has been implemented. Sub-document is
  a feature which vastly reduces network usage when operating on parts
  of documents.
  The API as it appears in this version is highly experimental and may
  (and likely will) change. Examples of use can be found in the `examples/subdoc`
  directory.
  * Priority: Major

* Make `lcb_sched_enter` and `lcb_sched_leave` optional.
  When scheduling an operation (e.g. `lcb_get3()`), the scheduling function
  will implicitly create a scheduling context and submit the operation if
  none exists already. A scheduling context is explicitly created by calling
  `lcb_sched_enter()` and finished by calling `lcb_sched_leave()` or
  `lcb_sched_fail()`.
  * Issues: [CCBC-664](https://issues.couchbase.com/browse/CCBC-664)
  * Priority: Major

* API3 is now stable.
  The scheduling based API, introduced in version 2.4.0 and known as 'api3',
  is now stable and considered the API for use with the library.
  The previous API (i.e. 'api2') is considered deprecated.

  While API3 has been promoted to stable in this version, it has been available
  in its current form (and in a mostly compatible manner, _except_ the implicit
  scheduling feature - CCBC-664) since 2.4.0.

  Storing an item in API2:

    lcb_get_store_t cmd = { 0 }, *cmd_p = &cmd;
    cmd.v.v0.key = "key";
    cmd.v.v0.nkey = 3;
    cmd.v.v0.bytes = "value";
    cmd.v.v0.nbytes = 5;
    cmd.v.v0.operation = LCB_SET;
    lcb_store(instance, NULL, 1, &cmd_p);

  Storing an item in API3:

    lcb_CMDSTORE cmd = { 0 };
    LCB_CMD_SET_KEY(&cmd, "key", 3);
    LCB_CMD_SET_VALUE(&cmd, "value", 5);
    cmd.operation - LCB_SET;
    lcb_store3(instance, NULL, &cmd);


* Add `libcouchbase/` string to version identification to Memcached
  Connections to memcached will now be identified as `libcouchbase/version`
  rather than `version`. This increases readability for server logs
  * Issues: [CCBC-656](https://issues.couchbase.com/browse/CCBC-656)
  * Priority: Minor

* Hide `mutation_token` field from API3 mutation respones. The `mutation_token`
  field has never been part of the API itself (it was previously present when
  api3 was marked as "experimental").
  The mutation token for any operation must now be retrieved using the
  `lcb_resp_get_mutation_token()` to retrieve the actual mutation token.
  * Issues: [CCBC-671](https://issues.couchbase.com/browse/CCBC-671)
  * Priority: Minor

* Server's `PROTOCOL_BINARY_RESPONSE_EINTERNAL` is no longer mapped to
  `LCB_EINTERNAL`. `LCB_UNKNOWN_MEMCACHED_ERROR` will be returned instead

* Allow get-and-touch with an expiry of 0.
  Clearing a document's expiry with `get` is now possible, using the new
  `LCB_CMDGET_F_CLEAREXP` in `lcb_CMDGET::cmdflags`.
  * Issues: [CCBC-667](https://issues.couchbase.com/browse/CCBC-667)
  * Priority: Major

* Allow multiple buckets when using sequence number consistency with N1QL
  This uses the new internal `scan_vector` protocol supporting multiple buckets,
  each providing their own `lcb_MUTATION_TOKEN` objects.
  * Issues: [CCBC-658](https://issues.couchbase.com/browse/CCBC-658)
  * Priority: Major

## 2.5.5 (January 12 2016)

* Add `retry_interval` string option to adjust retry interval.
  This allows the setting to be modified via `lcb_cntl_string()` and specified
  in the connection string.
  * Priority: Major
  * Issues: [CCBC-654](https://issues.couchbase.com/browse/CCBC-654)

* Handle backslashes in view row ID fields.
  This would previously not be handled correctly as the backslashes would not
  be removed, for example an ID of `has_a_"quote` would appear in the API as
  `has_a_\"quote`. This has been fixed and document IDs are now properly
  processed as JSON
  * Priority: Major
  * Issues: [CCBC-649](https://issues.couchbase.com/browse/CCBC-649)

* Allow 'file-only' configuration mode.
  This allows applications to make the library instance exclusively configured
  from a file on the local filesystem rather than through network bootstrap.
  This feature is undocumented and unsupported. It may be enabled using the
  `bootstrap_on=file_only` connection string directive.
  * Priority: Major
  * Issues: [CCBC-652](https://issues.couchbase.com/browse/CCBC-652)

* Log when squashing network errors.
  This will make the library log the original error whenever a network error
  is translated from a more detailed description into `LCB_NETWORK_ERROR`
  (in case `detailed_errcodes` is not enabled), or if an OS-level error is
  found which cannot be translated into a more specific library error.
  * Priority: Major

* Fix memcached/ketama hashing
  This fixes a bug in the ketama hasing code which caused a key to be mapped
  to an effectively arbitrary server for the library instance. In practice the
  node a key was mapped to depended on the order in which the hosts were
  specified in the connection string. This has been fixed to always use
  hashing based on the lexical sort order of each server node.
  It is highly recommended that applications upgrade to this version (2.5.5)
  for proper memcached (cache) bucket functionality.
  * Priority: Critical
  * Issues: [CCBC-653](https://issues.couchbase.com/browse/CCBC-653)

* Add `cbc-touch` subcommand.
  This now allows the simple "touching", or modifying expiration time via the
  `cbc` command line client.
  * Priority: Major
  * Issues: [CCBC-651](https://issues.couchbase.com/browse/CCBC-651)


## 2.5.4 (November 25 2015)

* Validate vBucket master nodes for bounds when receiving new configuration.
  This ensures that invalid configurations (addressing nodes which do not
  exist) do not make their way to KV routing operations.
  * Priority: Major
  * Issues: [CCBC-643](https://issues.couchbase.com/browse/CCBC-643)

* Add `lcb_strcbtype` to print the name of the callback type
  This small convenience function is added to pretty-print the type
  of callback being invoked. The second argument to the callback can be passed
  to this function.
  * Priority: Minor

* Disallow using `certpath` connection string option without explicit SSL
  (`couchbases://`) scheme. Since the SSL and non-SSL schemes are similar,
  a typo can let a user mistakenly think that SSL is being used. This is
  fixed by disallowing the other SSL option (`certpath`) when SSL is not
  enabled.
  * Priority: Minor
  * Issues: [CCBC-644](https://issues.couchbase.com/browse/CCBC-644)

* Add convenience function to retrieve hostname for key.
  This is an alternative to retrieving the vBucket configuration (via `lcb_cntl()`)
  and mapping the key to an index, and mapping the index to a node. Note that
  hostnames are sufficient for most but not all configurations. Those running
  multiple server instances on the same host (for example, `cluster_run`) will
  still need to use the full set of steps as this function does not return a
  port. This function is provided both as a vBucket API (`lcbvb_get_hostname()`)
  which retrieves the hostname for an index as well as a top-level instance
  (`lcb_t`) function (`lcb_get_keynode()`) which accepts a key buffer and length.
  * Priority: Minor

* Ensure embedded jsoncpp does not throw exceptions.
  This caused some build issues with other build systems. This has been fixed
  by replacing any exception throwing code with `abort()` and `assert()`
  statements.
  * Priority: Minor
  * Issues: [CCBC-634](https://issues.couchbase.com/browse/CCBC-634)

* Log vBucket configuration parsing failures.
  This logs vBucket configuration parsing failures when a given config received
  could not be parsed. Parsing failures include both JSON syntax errors as well
  as improper fields or values within the config itself.
  * Priority: Major
  * Issues: [CCBC-647](https://issues.couchbase.com/browse/CCBC-647)

* Allow per-request N1QL timeouts to exceed global timeouts.
  This scans the `"timeout"` property of the N1QL request and if set, will
  make the value of this property the timeout value for the request. A small
  parser was implemented which converted the N1QL timeout values (`s`, `h`, etc.)
  into microseconds.
  * Priority: Major
  * Issues: [CCBC-660](https://issues.couchbase.com/browse/CCBC-660)

* Request configuration refresh when HTTP API redirects are received.
  Redirects in Couchbase Server are sent when a node is about to exit the
  cluster. We should take this as a sign to refresh the config since it indicates
  a node is about to be removed.
  * Priority: Major
  * Issues: [CCBC-646](https://issues.couchbase.com/browse/CCBC-646)


## 2.5.3 (August 27 2015)

* Add N1QL timeout feature.
  This allows an independent timeout setting for N1QL. Previously this would
  use the views timeout.
  * Priority: Major
  * Issues: [CCBC-631](https://issues.couchbase.com/browse/CCBC-631)

* Add N1QL prepared statements.
  This allows prepared statements to be used with N1QL. The library will
  maintain an internal "prepared statement cache" which contains cached
  responses for internal PREPARE requests. To use a prepared statement, an
  application can simply set the `LCB_CMDN1QL_F_PREPCACHE` bit in the
  `cmdflags` field within the `lcb_CMDN1QL` structure. All the rest is
  handled internally within the library.
  * Priority: Major
  * Issues: [CCBC-633](https://issues.couchbase.com/browse/CCBC-633)

## 2.5.2 (July 23 2015)

* Fix off-by-one error when populating documents with pillowfight.
  Previously pillowfight would only populate N-1 documents where N
  is the (`-I`, `--num-items`) option. This has been fixed.
  * Priority: Minor

* Don't generate negative keys for pillowfight.
  For certain option configurations, pillowfight would generate negative keys
  (some keys were in the format of -nnnnnn).
  * Priority: Minor

* Allow in-progress N1QL requests to be cancelled.
  This allows in-progress N1QL requests to be cancelled by adding a new API,
  `lcb_n1ql_cancel()`. Invoking this function on an `lcb_N1QLHANDLE` handle
  (obtained via an _out_ parameter in the command structure) will effectively
  stop the request and stop delivering callbacks to the user.
  * Priority: Major
  * Issues: [CCBC-619](https://issues.couchbase.com/browse/CCBC-619)

* Rename `lcb_SYNCTOKEN` to `lcb_MUTATION_TOKEN`.
  This experimental (volatile) API has been renamed to "Mutation Token" to
  better reflect naming conventions found in other client libraries.
  * Priority: Minor

* Implement histogram/timings information for N1QL queries via `cbc-n1qlback`.
  This adds support for the (`-T`, `--timings`) option in the
  `cbc-n1qlback` benchmark/stress-test utility. These timings reflect the
  latency between issuing the query and the receipt of the first row of the
  resultset.
  * Priority: Major
  * Issues: [CCBC-624](https://issues.couchbase.com/browse/CCBC-624)

* Add (`-M`, `--mode`) option to `cbc-create` to allow for upsert, insert, etc.
  This allows `cbc-create` to use the full gamut of storage options available
  via the SDK by allowing an insert/upsert/replace mode as an argument to the
  new `--mode` option. `append` and `prepend` are now also provided as options,
  though not documented.
  * Priority: Major
  * Issues: [CCBC-625](https://issues.couchbase.com/browse/CCBC-625)

* Support `CBC_CONFIG` environment variable for command line tools.
  This variable specifies a path to an alternate `cbcrc` file which may be
  used to provide cluster/bucket settings. This new option allows multiple
  configurations to coexist, without forcing any one of them to be inside the
  user's home directory.
  * Priority: Minor
  * Issues: [CCBC-626](https://issues.couchbase.com/browse/CCBC-626)


## 2.5.1 (June 17 2015)

Bug fixes and improvements in 2.5.1

* Fix hanging in durability operations if node is not present and constraints
  include failed node. This condition may be triggered when only a single node
  remains in the broadcast probe and a command sent to it could not be scheduled.
  A symptom of this bug was durability operations 'hanging'
  * Priority: Major
  * Issues: [CCBC-607](http://issues.couchbase.com/browse/CCBC-607)

* Improved handling of topology changes when non-data (N1QL, Index) nodes are
  part of the cluster. This fixes some issues (mainly crashes) when non-data
  nodes are found inside the cluster during a topology change. While the library
  since version 2.4.8 was able to handle initial bootstrapping with non-data
  nodes, it would still crash when such nodes were encountered during
  configuration changes.
  * Priority: Major
  * Issues: [CCBC-609](http://issues.couchbase.com/browse/CCBC-609),
    [CCBC-612](http://issues.couchbase.com/browse/CCBC-612)

* Improved random host selection algorithm for REST services
  This new algorithm ensures that the distribution is even among all _eligible_
  nodes for a given service. The old algorithm would only distribute evenly when
  the assumption that all nodes contained the same services were true. However
  this assumption is no longer necessarily true with Couchbase 4.0. In this case
  the algorithm ensures that the random selection inspects only the pool of
  nodes which are known to have a given service enabled.
  * Priority: Major
  * Issues: [CCBC-611](http://issues.couchbase.com/browse/CCBC-611)

* Ensure ketama/Memcached-bucket hashing works correctly when non-data nodes
  are part of the cluster. In previous versions, ketama hashing would incorrectly
  consider all nodes as candidates for keys, which would result in some items
  being routed to non-data nodes, resulting in odd errors and inaccessible
  data. This is only an issue for the still-unreleased Couchbase 4.0.
  * Priority: Major
  * Issues: [CCBC-613](http://issues.couchbase.com/browse/CCBC-613)

* Set `TCP_NODELAY` as a server side option, if it's enabled on the client.
  This uses the `HELLO` protocol functionality to enable this feature, if
  this feature is also enabled on the client (enabled by default).


New features in 2.5.1

* Add `cmake/configure` option for enabling the embedding of the libevent
  plugin. This option, named `--enable-embedded-libevent-plugin`, will cause
  the plugin to be linked in with the core library (_libcouchbase_) rather
  than built as its own object
  * Priority: Minor

* Add new combined "Store-with-durability" operation. This new API, called
  `lcb_storedur3()` allows specifying the storage input options as well as
  the associated durability options in a single command. Likewise, the status
  of the operation (including durability) is returned in the operation's
  callback.
  * Priority: Major
  * Issues: [CCBC-616](http://issues.couchbase.com/browse/CCBC-616)


## 2.5.0 (May 12 2015)

This change in the major version number signals the addition of new features
for Couchbase Server 4.0; most of the actual new functionality for Couchbase
4.0 has already been included (incrementally) in prior 2.4.x versions. The
new 2.5 version is built on the 2.4.x codebase.

* Add `cbc-n1qlback` - a simple benchmark for N1QL queries. This functions
  by executing a line-delimited file containing query bodies using multiple
  threads if possible.
  * Priority: Major
  * Issues: [CCBC-604](http://issues.couchbase.com/browse/CCBC-604)

* `TCP_NODELAY` functionality has now been placed into effect. This
  functionality was nominally present in prior versions, but would not work
  because of a typo.
  * Priority: Minor

* Add 'tick' or 'pump' mode for I/O
  As an alternative to `lcb_wait()`, applications may call `lcb_tick_nowait()`
  to incrementally perform (non-blocking) I/O. This may provide a performance
  boost when batching/scheduling many operations. `lcb_wait()` itself must be
  called to guarantee completion of all operations, and the `lcb_tick_nowait()`
  functionality is only available on some I/O plugins. See the API docs for
  more information.
  * Priority: Major
  * Issues: [CCBC-598](http://issues.couchbase.com/browse/CCBC-598)

* Allow "console logger" to log to a file
  As a convenience, it is now possible to direct the library to write to
  a log file rather than standard error. This is possible using the
  `LCB_CNTL_CONLOGGER_FP` (to programmatically set a `FILE*` value via
  `lcb_cntl()`) or `console_log_file` to set the path of the file (which
  will be overwritten) via `lcb_cntl_string()` or the connection string.

* Make `lcb_N1QLPARAMS` repeatable/debuggable
  This allows the `lcb_n1p_mkcmd()` call to be invoked multiple times without
  actually modifying internal state. Previously calling this function twice
  would result in corruption of the internal parameter state. In this version,
  a new function, `lcb_n1p_encode()` has been added (which `lcb_n1p_mkcmd()`
  wraps) which may be used to inspect the encoded form of the query.

## 2.4.9 (April 14 2015)

* Disable HTTP provider when any CCCP config is received.
  This makes the assumption that CCCP will always be available if even a
  single node provides an HTTP configuration. This change may break some
  corner-case upgrade scenarios from version 2.2 to 2.5 where a newly added
  2.5 node is subsequently removed.
  * Priority: Major
  * Issues: [CCBC-526](http://issues.couchbase.com/browse/CCBC-526),
    [CCBC-589](http://issues.couchbase.com/browse/CCBC-589)

* Fix additional missing defines for UV's `EAI_*` symbols
  This was not entirely fixed in 2.4.8, since some undefined macros still
  remained.
  * Priority: Major
  * Issues: [CCBC-596](http://issues.couchbase.com/browse/CCBC-596)

* Make connection string timeout parameters (e.g. `operation_timeout`) always
  specify seconds; this will no longer require the decimal point to be used,
  but will break any prior usages of this value for microseconds.
  * Priority: Minor
  * Issues: [CCBC-597](http://issues.couchbase.com/browse/CCBC-597)

* Add `cbc n1ql` subcommand, which executes N1QL queries.
  This subcommand is still a bit rough around the edges, mainly because of
  server-side support for "pretty=false" (which makes the rows display rather
  weirdly).
  * Priority: Major
  * Issues: [CCBC-595](http://issues.couchbase.com/browse/CCBC-595)

* Allow usage of `-D` option in `cbc` and `cbc-pillowfight` tools.
  This flag allows specifying connection string options in a more
  concise form on the commandline. The `-D` option may be specified
  multiple times in the form of `-Doption=value`.
  * Priority: Minor

* Interpret `couchbase://host:8091` connection string as `couchbase://host`
  Previously the library would treat `8091` as a memcached port. While technically
  correct according to the connection string semantics, would often be a
  source of confusion for users migrating from older versions of the library
  (or other SDKs) when using the form `http://host:8091`. A special provision
  is thus made for such a cas.
  * Priority: Major
  * Issues: [CCBC-599](http://issues.couchbase.com/browse/CCBC-599)

* Implement enhanced durability using sequence numbers.
  This feature is available in Couchbase 4.0, and uses sequence numbers
  (optionally specified in the response packet of each mutation).
  sequence-based durability constraints help resolve some ambiguity in
  the case of checking the durability of items which have since been
  mutated, or in the case of a cluster failover. Using this functionality
  requires the `LCB_CNTL_FETCH_SYNCTOKENS` (or `fetch_synctokens`) and the
  `LCB_CNTL_DURABILITY_SYNCTOKENS` (or `dur_synctokens`)
  settings to be enabled (using `lcb_cntl()` or `lcb_cntl_string()`, or
  in the connection string). Enabling `LCB_CNTL_FETCH_SYNCTOKENS` will
  cause mutation response packets from the server to return an additional
  16 bytes of sequence data, and enabling `LCB_CNTL_DURABILITY_SYNCTOKENS`
  will cause `lcb_durability_poll()` to transparently use this information
  (rather than the CAS) to check for persistence/replication.
  **Only available in Couchbase 4.0**. As a result of this feature, much
  of the durability subsystem itself has been rewritten, making durability
  overall more performant, even for CAS-based durability.
  * Priority: Major
  * Issues: [CCBC-569](http://issues.couchbase.com/browse/CCBC-569)

* Add `lcb_version_g` extern symbol as alternative to `lcb_get_version()`.
  This symbol is an extern global which allows simple runtime checking of
  the library version. This is more convenient than `lcb_get_version()` as
  it avoids the requirement to create a temporary variable on the stack
  (`lcb_get_version()` returns a string, and requires an `lcb_U32` pointer
  as its first argument to get the actual numeric version).
  * Priority: Minor


## 2.4.8 (Mar. 8 2015)

* Retry next nodes on initial bootstrap, even if first node says bucket does
  not exist (or auth error), as this might be a recently removed node
  * Priority: Major
  * Issues: [CCBC-577](http://issues.couchbase.com/browse/CCBC-577)

* The `cbc` and `cbc-pillowfight` binaries on Windows are now distributed
  in both _release_ and _debug_ variants. Previously they would be clobbered
  by one or the other depending on the build host. This fixes some issues in
  performance and dependency resolution when using these libraries.
  * Priority: Minor
  * Issues: [CCBC-581](http://issues.couchbase.com/browse/CCBC-581)

* Provide Read-Only config cache mode. In this mode the configuration cache
  file is read but never updated. Additionally, a missing file in this mode
  results in a hard error.
  * Priority: Major
  * Issues: [CCBC-584](http://issues.couchbase.com/browse/CCBC-584)

* Keep vBucket heuristic guesses for limited periods of time.
  This will allow previously-learned vBucket master locations to persist
  over a configuration change, providing these changes were discovered
  recently. This allows the reduction of not-my-vbucket responses while
  allowing new configs to overwrite our heuristic info, if the heuristic is
  too old.
  * Priority: Major

* Fix potential crashes in get-with-replica (`lcb_rget3`, `lcb_get_replica`)
  when there are no replicas available, or if there is an error in retrieving
  from one of the replicas.
  * Priority: Major
  * Issues: [CCBC-586](http://issues.couchbase.com/browse/CCBC-586)

* Do not wait between not-my-vbucket retries
  This behavior restores the pre 2.4.0 behavior of retrying not-my-vbucket
  responses, with a more intelligent retry/rotation algorithm (see the
  release note about "vbucket map heuristics"). Previously a wait-time
  was introduced because of potential busy loops in retrying to the same
  node. The `LCB_CNTL_RETRY_NMV_IMM` setting can be used to disable this
  functionality (by disabling it, i.e. setting it to 0). This may also be
  disabled in the connection string via `retry_nmv_imm=0`.
  * Priority: Major
  * Issues: [CCBC-588](http://issues.couchbase.com/browse/CCBC-588)

* Fix compilation error with UV when `EAI_BADHINTS` is not defined in the
  system. This is primarily an issue with newer UV versions and some versions
  of Linux
  * Priority: Major
  * Issues: [CCBC-590](http://issues.couchbase.com/browse/CCBC-590)

* Allow means to disable C++ behavior on public library structures, allowing
  them to be initialized via C-style static initializers.
  This allows the zeroing of structures such as `lcb_get_cmd_t cmd = { 0 }`,
  which would ordinarily fail under C++ compilation because of that structure
  having a defined C++ constructor. Applications can take advantage of this
  feature by defining the `LCB_NO_DEPR_CXX_CTORS` preprocessor macro when
  compiling.
  * Priority: Major
  * Issues: [CCBC-591](http://issues.couchbase.com/browse/CCBC-591)

* Fix some bugs in timing behavior (`lcb_enable_timings`). Timings between
  1000-2000ms are now reported accurately. Additionally for more common
  handling, second timing ranges (between 1-9s) are reported in ms range
  (i.e. timings of 4 seconds are reported as 3000-4000ms ).
  * Priority: Minor
  * Issues: [CCBC-582](http://issues.couchbase.com/browse/CCBC-582)


## 2.4.7 (Feb. 17 2015)

* Fix SSL connection failures with `SSL_UNDEFINED_CONST_FUNCTION`.
  This would sometimes cause failures during early connection/negotiation
  stages.
  * Priority: Major
  * Issues: [CCBC-571](http://issues.couchbase.com/browse/CCBC-571)

* Add _experimental_ support for N1QL queries.
  This adds support for contacting N1QL endpoints and retrieving their
  result sets. The support at both the client and server components is
  still a work in progress.
  The API is similar to the view api (see `lcb_view_query()`) added in
  version 2.4.6. See details in `<libcouchbase/n1ql.h>`
  * Priority: Major
  * Issues: [CCBC-572](http://issues.couchbase.com/browse/CCBC-572)

* Add _experimental_ support for geospatial view queries.
  GeoSpatial views are available as an experimental feature in the
  current releases of the server. This will soon be offered as a
  stable feature in future releases.
  Applications may now use the `lcb_RESPVIEWQUERY::geometry` field
  and the `LCB_CMDVIEWQUERY_F_SPATIAL` to utilize geospatial views.
  * Priority: Major
  * Issues: [CCBC-573](http://issues.couchbase.com/browse/CCBC-573)

* Fix memory leak for retried commands.
  In cases where a given command needs to be retried more than once, a
  memory leak was fixed in which the previous instance of the pacekt was
  not properly freed.
  * Priority: Major
  * Issues: [CCBC-574](http://issues.couchbase.com/browse/CCBC-574)

## 2.4.6 (January 20 2015)

* Fix floating point exception on OS X.
  A floating point exception would sometimes be thrown on OS X sytems due
  to bad time structure initialization. The installation provided with
  homebrew for 2.4.5 fixed this issue. This is completely fixed in 2.4.6
  Priority: Major

* Improve warning messages when using deprecated options in `cbc`.
  This provides less ambiguous help messages when using deprecated options,
  showing a full and complete example for proper usage (when possible).
  * Priority: Minor
  * Issues: [CCBC-562](http://issues.couchbase.com/browse/CCBC-562)

* Add patch/micro version to DLL information on Windows.
  This lets the user see the exact version of the library on windows (via
  right clicking on the DLL and inspecting the details). Previously this
  information contained only the major and minor versions.
  * Priority: Minor
  * Issues: [CCBC-563](http://issues.couchbase.com/browse/CCBC-563)

* Provide _pkgconfig_ (`.pc`) file with installation.
  This may help third party applications and libraries link against libcouchbase
  in some environments.

* Provide one-off `unsafe_optimize` option for connection string/`lcb_cntl`.
  This provides a shorter way to enable some potentially unsafe optimizations
  which may make the client perform better in some scenarios.
  * Priority: Minor

* Allow prompting for password in `cbc`.
  The `cbc` and `cbc-pillowfight` utilities will now securely prompt for the
  password if the password specified on the commandline is a hyphen (`-`).
  * Priority: Minor
  * Issues: [CCBC-565](http://issues.couchbase.com/browse/CCBC-565)

* Fix timeouts in some durability when not all replicas are online.
  The library will now fail the operation with `LCB_DURABILITY_ETOOMANY`
  rather than allowing the operation to timeout.
  * Priority: Major
  * Issues: [CCBC-560](http://issues.couchbase.com/browse/CCBC-560)

* Add high level row-based view functionality.
  This adds a new API (currently considered _volatile_) which allows
  intelligently querying views. This builds atop the basic HTTP
  interface, and exposes a row-based callback API based upon
  streaming JSON parsing. The new API is defined in `<libcouchbase/views.h>`.
  This API will become more stable over time.
  * Priority: Major
  * Issues: [CCBC-100](http://issues.couchbase.com/browse/CCBC-100)

* Parse configuration service locations for experimental services
  This exposes the N1QL and indexing services via the _lcbvb_ API. See
  `libcouchbase/vbucket.h` for more information.

## 2.4.5 (December 17 2014)

* Fix `pillowfight` ignoring `set-ratio` values above 50
  The program would ignore these values and act as if 100 was specified,
  thus never issuing any GET operations
  * Priority: Minor
  * Issues: [CCBC-550](http://couchbase.com/issues/browse/CCBC-550)

* Building with autotools is no longer supported.
  If building the library from source, you _must_ use
  [CMake](http://cmake.org/download) version 2.8.9 or greater. If unfamiliar
  with CMake, the README describes the process. Included also is a top-level
  script called `configure.pl` which functions with an autoconf-like interface.
  * Priority: Major

* Fix customized IOPS crashes in some usage cases
  This fixes scenarios where applications assume that the built-in IOPS version
  is 0, and attempt to "Subclass" the IOPS structure. The internal version of
  the library structure is now 3, with some extra heuristics in place to ensure
  that the older code will still function.
  This issue was most visible in the Python SDK when using the gevent or Twisted
  plugins.
  This issue was first introduced with version 2.4.4
  * Priority: Critical
  * Issues: [CCBC-557](http://couchbase.com/issues/browse/CCBC-557)

* Allow raw `certpath` to be passed without need for percent-encoding (in most cases)
  This allows for a common pattern fo passing `certpath` in the connection string as
  a raw, unencoded path. This allows a user to do
  `couchbases://host/bucket?certpath=/foo/bar/baz`.

* Fix missing installation UV plugin headers and source
  In 2.4.4 this was accidentally left out, and would only be installed if the plugin
  itself was built and installed. This affected building the Node.JS SDK using an
  existing libcouchbase install.
  * Priority: Major
  * Issues: [CCBC-558](http://couchbase.com/issues/browse/CCBC-558)

## 2.4.4 (Nov. 19 2014)

* Detect disconnected pooled sockets
  This allows the connection pool to detect dead sockets which were closed
  by a server when they were idle. Sometimes servers will close connections
  to open idle sockets to save resources, or because of bugs in their
  implementations.
  This will fix some issues experienced with views where queries would
  randomly fail with `LCB_NETWORK_ERROR` or `LCB_ESOCKSHUTDOWN`, by first
  checking if the socket is alive before returning it back to the library's
  core.
  Note that the `libuv` plugin does not implement this functionality yet.
  * Priority: Critical
  * Issues: [CCBC-546](http://couchbase.com/issues/browse/CCBC-546)

* Fix _pillowfight_ `--min-size` bug
  This fixes a bug where pillowfight would sometimes compare the `min-size`
  option to an uninitialized `max-size` option and round it down to that
  value; then would set the `max-size` option.
  * Priority: Major
  * Issues: [CCBC-542](http://couchbase.com/issues/browse/CCBC-542)

* Don't ignore `LCB_CNTL_DURABILITY_INTERVAL`
  Fix a bug where this interval would be ignored, if modified by the user; always
  reverting to 100ms.
  * Priority: Major
  * Issues: [CCBC-543](http://couchbase.com/issues/browse/CCBC-543)

* Fix memory leak with HTTP requests using a request body
  Requests (such as `PUT`, `POST`, etc) which contained a request body
  would cause a memory leak as the library forgot to free them when the
  request object was destroyed.
  * Priority: Major
  * Issues: [CCBC-538](http://couchbase.com/issues/browse/CCBC-538)

* Fix errneous `LCB_SUCCESS` return when passed duplicate keys to
  `lcb_durability_poll()`. This would cause applications to mistakenly wait
  for a callback to arrive, when in fact the command had failed.
  * Priority: Major
  * Issues: [CCBC-536](http://couchbase.com/issues/browse/CCBC-535)

* Add option to preserve vbucket ownership heuristics across config updates
  This allows the learned configuration settings to persist between configuration
  updates. The default behavior (up to, and including this change) is to
  discard any "learned" configuration in favor of the explicitly new config
  passed to the server. This new option allows this information to be persisted
  when a new configuration update is received. This behavior is considered
  experimental, and is primarily intended to reduce the time it takes for the
  client to relearn the current node (which is typically under 1-2 seconds).
  * Priority: Minor
  * Issues: [CCBC-530](http://couchbase.com/issues/browse/CCBC-530)

* Relocate memcached packets on topology changes for memcached buckets
  This enhances the behavior of the client when operating with a memcached
  bucket during a topology change. Previously the library would not relocate
  packets to new servers, resulting in errors for items which were now
  mapped to wrong nodes. The new behavior remaps the key to the new server
  using the updated ketama hashing. Note that as a current restriction, the
  remapping will be performed based on the key of the item, not any `hashkey`
  parameter being employed.
  * Priority: Major
  * Issues: [CCBC-331](http://couchbase.com/issues/browse/CCBC-331)

* Return error if ignored/conflicting options are found
  This changes the behavior of the library to throw an error if a specific
  option field was filled in which did not make sense for a given command, for
  example, specifying a `cas` value using a `LCB_ADD` operation with `lcb_store`.
  * Priority: Major
  * Issues: [CCBC-529](http://couchbase.com/issues/browse/CCBC-529)

* Fix issue when sending out large _OBSERVE_ command.
  This would cause a partial command to be sent out if the size of the output
  packet was greater than 512 bytes. This has been fixed by dynamically growing
  the output buffer for _OBSERVE_
  * Priority: Minor
  * Issues: [CCBC-528](http://couchbase.com/issues/browse/CCBC-528)

* Fix spurious timeouts when using `lcb_durability_poll`
  This fixes an issue where sometimes the durability poll operation would
  prematurely time out.
  * Priority: Major
  * Issues: [CCBC-527](http://couchbase.com/issues/browse/CCBC-527)

## 2.4.3 (Oct. 21 2014)

* Disable support for SSLv3
  This works around the _POODLE_ SSLv3 vulnerability by disabling support for
  anything below TLSv1.

  * Priority: Critical
  * Issues: [CCBC-523](http://couchbase.com/issues/browse/CCBC-523)

* Pillowfight enhancements
  Several behavior changes were made to pillowfight in this version. These are:
  * The `-l` or `-c -1` option is in effect by default. This means that by
    default `pillowfight` will run an infinite number of cycles. The previous
    behavior was to default to a single cycle, requiring an explicit `--loop`
    to ensure the workload ran for a considerable amount of time.

  * When multiple threads are used, the workload is divided among the threads,
    thus making it that each thread only operates on a subset of the data.

  * A `--sequential` option has been added to allow the workload to operate
    in _sequence_ on the total number of items. This is useful when wishing to
    load a bucket with many items.

  * A `--start-at` option has been added to allow the workload to specify an
    alternate range of keys; effectively allowing resumption of a previous
    run. The `--start-at` flag allows to specify the lower bound number which
    will be used to generate keys. Thus a `--num-items=20000` and a
    `--start-at=10000` will generate keys from 10000 through 30000.

  * The _population_ phase has now been merged with the general workload
    implementation. This means that all worker threads will participate in
    the population phase. The previous behavior limited the populate phase to
    a single thread.

  * If `stdout` is detected to be a terminal, a simple "OPS/SEC" meter will
    periodically write the estimated throughput to the screen.

* Fix memory leak when using large read buffers
  In the case where large read buffers are used (and the `iovec` elements
  becomes sizable, the library may end up incorrectly caching some memory
  blocks for future use. This fix makes the blocks be cached at the allocator
  level, so that they are properly (re) utilized.

  * Priority: Major
  * Issues: [CCBC-519](http://couchbase.com/issue/browse/CCBC-519)

* Use forward map (and other heuristics) to get a next node for an item after
  a not-my-vbucket reply. Since the server (see bug attached) does not always
  guarantee that a given config is the most _correct_, the client must do some
  guesswork in order to properly map a node when it gets a not-my-vbucket;
  especially if the config says that the node is the correct one.

  * Priority: Major
  * Issues: [MB-12268](http://couchbase.com/issues/browse/MB-12268)

## 2.4.2 (Sep. 23 2014)

* Mark the `hashkey` fields as being _volatile_.
  Usage of this field is not supported in many cluster systems and is thus not
  supported functionality. It exists primarily as a legacy from an older API
  * Priority: Major
  * Issues: [CCBC-508](http://couchbase.com/issues/browse/CCBC-508)

* Add "key stats" mode to `lcb_CMDDSTATS`.
  This adds an additional key stats mode to the `lcb_stats3()` API
  which interprets the `key` field as being a document ID for which
  information (such as expiry, status) should be retrieved, rather
  than a system statistics key. Similar functionality already exists
  in the Java client library as `getKeyStats()`. In addition to this
  feature, a `cbc stats --keystats` option is also provided to employ
  this functionality from the command line.
  * Priority: Major
  * Issues: [CCBC-318](http://issues.couchbase.com/browse/CCBC-318)

* Add more details about replica nodes in the `cbc hash` command.
  * Priority: Minor
  * Issues: [CCBC-504](http://couchbase.com/issues/browse/CCBC-504)

* Add `lcb_cntl()` setting to retrieve bucket name.
  Previously the library did not have a means by which the bucket name
  could be retrieved. Using the `LCB_CNTL_BUCKETNAME` setting, the bucket
  name will now be returned.
  * Priority: Major
  * Issues: [CCBC-502](http://issues.couchbase.com/browse/CCBC-502)

## 2.4.1


* Implement `mcflush` subcommand for `cbc`. This was removed in the cbc
  rewrite as the previous `flush` command.
  * Priority: Minor
  * Issues: [CCBC-486](http://couchbase.com/issues/browse/CCBC-486)


* Requests issued to an invalid replica via `lcb_get_replica()` should fail
  with the `LCB_NO_MATCHING_SERVER_CODE`. Previously this sometimes went
  through due to an incorrect bounds checking in the `lcbvb_vbreplica()`
  function.
  * Priority: Major
  * Issues: [CCBC-488](http://couchbase.com/issues/browse/CCBC-488)


* Fixed a memory leak in `lcb_get_replica()` when the operation would fail.
  * Priority: Major
  * Issues: [CCBC-489](http://couchbase.com/issues/browse/CCBC-489)
    [CCBC-490](http://couchbase.com/issues/browse/CCBC-490)



* Fix memory leak in `lcb_sched_fail()` when extended commands are in the
  pipeline
  * Priority: Major
  * Issues: [CCBC-474](http://couchbase.com/issues/browse/CCBC-474)



* Provide `lcb_dump()` function call to dump state information about
  a client handle. The function call itself is currently marked as
  volatile and the output format is very much likely to change.
  * Priority: Minor
  * Issues: [CCBC-491](http://couchbase.com/issues/browse/CCBC-490)


* Fix `ratio` argument in `cbc-pillowfight`. This ensures that the
  `ratio` argument will truly determine the ratio of gets to sets.
  * Priority: Minor

* Fix crash when HTTP request is retried. This may take place during topology
  changes
  * Priority: Major
  * Issues: [CCBC-497](http://couchbase.com/issues/browse/CCBC-497)

* Allow simple host-port string in connection string, giving it an implicit
  `http://` scheme. This allows easier backwards compatibility with some
  application
  * Priority: Minor
  * Issues: [CCBC-500](http://couchbase.com/issues/browse/CCBC-500)

* Update some SSL options to better reflect server 3.0 functionality
  The old `capath` option has been renamed to `certpath` to indicate that the
  path is not to the signing authority, but to the self-signed server certificate
  generated by the server itself. Additionally the `no_verify` option has been
  hidden.
  * Priority: Major
  * Issues: [CCBC-501](http://couchbase.com/issues/browse/CCBC-501)

## 2.4.0 GA

* [major] Attempt to retry items that are mapped to a non-existent node in
  a degraded cluster. Rather than returning `LCB_NO_MATCHING_SERVER` the
  behavior should be to wait for the item to succeed and attempt to fetch
  a new cluster configuration.

  In order to control how such 'orphaned' commands are handled, a new value
  has been added to the `lcb_RETRYMODEOPTS` called `LCB_RETRY_ON_MISSINGNODE`
  which dictates how commands should be rescheduled if the associated vbucket
  has no master. The default is to retry the command until it times out, but
  by setting this value to `0` (See `LCB_CNTL_RETRYMODE`) it may only be
  attempted once, causing 'fail fast' behavior in such a case.

* [major] Don't throttle config requests based on initial file-based config.
  This allows the client to quickly recover from a stale config cache without
  waiting for the `LCB_CNTL_CONFDELAY_THRESH` interval to elapse. Prior to this
  fix, a client would appear to "not recover" if bootstrapping from a stale cache.
  In reality the client would eventually recover but was waiting for the delay
  threshold to elapse.

* [major] Ignore `NOT_MY_VBUCKET` config payloads if CCCP provider is disabled.
  This allows the client to circumvent any possible bugs in the CCCP response
  payload and rely entirely on the HTTP config. It also allows 'rewriting'
  proxies like confsed to function.

## 2.4.0-beta

* [major] Better error reporting for SSL failures.
  This adds new error codes (`LCB_SSL_ERROR`, `LCB_SSL_CANTVERIFY`)
  which are returned on initialization and verification failures
  respectively.

* [minor] Communication via legacy memcached servers is possible
  by using the `memcached://` scheme in the connection string.

* [minor] Environment variables understood by the library are now
  documented in their own section.

* [major] Add `lcb_get_node()` function to retrieve addresses for
  various nodes in the cluster. This deprecates the `lcb_get_host()`,
  `lcb_get_port()` and `lcb_get_server_list()` functions as they are
  constrained to only return information about the administrative API.
  The new function is configurable to return information about various
  ports.

* [major] The `dsn` field in the `lcb_create_st` structure has been
  renamed to `connstr`.

* [major] An HTTP request which has followed redirects will cause the
  `lcb_wait()` function to never return. This bug was introduced in
  2.4.0-DP1 and has now been fixed.

* [minor] `lcb_get_server_list()` function now returns updated information
  from the current cluster configuration. Previously this would only return
  a node from the list specified during initial creation.

* [minor] Provide additional error classifiers. Two error classifiers have
  been added, they are:

  * `LCB_ERRTYPE_SRVLOAD` which indicates that the server is likely under high load.
  * `LCB_ERRTYPE_SRVGEN` which indicates that the error is a direct reply from the
    server. This code can help distinguish between client and server generated
    return codes.

* [major] Provide HTTP keepalive and connection pooling for HTTP requests.
  This allows the client to reuse an HTTP connection for multiple requests
  rather than creating a new connection and closing it for each operation.

  The functionality may be controlled via the `LCB_CNTL_HTTP_POOLSIZE` setting
  which limits how many open connections (per server) to maintain inside the
  client. Setting this value to `0` will disable pooling and restore old
  behavior.

* [major] Properly schedule next invocations for retry queue. A bug was introduced
  in 2.4.0-dp1 which would cause the next tick callback to be invoked in what is
  effectively a busy loop. This would be reflected in higher CPU load and less
  throughput during topology changes.

* [major] Return error if empty key is passed to an operation. Empty keys will
  cause the server to drop the connection.
  The error code returned is the newly added `LCB_EMPTY_KEY`

* [minor] Provide setting to disable refreshing the configuration when an HTTP
  API error is encountered (from one of the HTTP callback functions). This
  adds the `LCB_CNTL_HTTP_REFRESH_CONFIG_ON_ERROR` setting.

* [major] Fix bug where the CCCP provider may prematurely fail, activating the
  HTTP provider


## 2.4.0-dp1 (2014-06-18)


**Changes affecting older APIs**

* [minor] Make `run_event_loop` and `stop_event_loop` private.
  These functions may no longer be used from within an application to
  start/stop the event loop. `lcb_wait()` and `lcb_wait3()` should be
  used instead.

* [major] Deprecate the `lcb_set_XXX` functions. `lcb_set_timeout`
  and some other calls have been deprecated in favor of the `lcb_cntl()`
  interface. These functions will still work but will cause the compiler
  to print a deprecation warning.

* [minor] `lcb_socket_t` is typedefed to a `DWORD` on windows. In
  previous versions this was an `int`.

* [minor] Connecting to a standalone memcached instance is currently no longer
  supported.

* [major] `lcb_set_error_callback()` has been deprecated. Applications should
  use the new `lcb_set_bootstrap_callback()` and/or operation callbacks
  to determine success/failure status.

* [major] `lcb_get_last_error()` has been deprecated. Error information is always
  returned in the operation callback

* [major] Disable the sending of `GETQ` packets. The format of this command
  is cumbersome to deal with and in most uses cases is actually slightly
  _less_ efficient on the network. Note that this does not change the API
  of the actual `lcb_get()` call, but simply changes the format of the
  packets sent over the wire.

* [major] The IOPS API has been changed. This is considered volatile interface
  and may subsequently change in the future as well.

**New APIs added in 2.4.0 extending existing functionality**

These changes extend existing features with enhanced APIs

* [major] Additional APIs for `lcb_cntl()`. These consist of helper functions
  to make it easier to use simple types or strings rather than pointers, if
  possible. These functions are `lcb_cntl_string()`, `lcb_cntl_setu32()` and
  `lcb_cntl_getu32()`

* [minor] Provide extended version of `lcb_wait()`.
  A new function called `lcb_wait3()` has been added which offers additional
  options with respect to running the event loop. Specifically it offers to
  bypass the check for pending operations which `lcb_wait()` executes. This
  is both more performant and allows us to wait for operations which are
  not explicitly scheduled.

* [major] Provide API to request a configuration refresh.
  Sometimes it is necessary to force the client to request a new configuration,
  for example in certain failover conditions. A new API called `lcb_config_refresh()`
  has been added, and should be used in conjunction with `lcb_wait3()`.

* [major] Provide bootstrapping notification callback
  This provides an explicit `lcb_set_bootstrap_callback()` to definitively
  determine whether the client has received its initial configuration (and
  thus may now start performing operations) or whether it failed (and thus
  must be reinitialized). This deprecates the common use case of
  `lcb_set_error_callback()`.

* [major] New vBucket interface/API. This API is used internally and exposed
  as _volatile_ inside the public header files. It provides extended features,
  a more concise API, and is compatible with the upcoming Couchbase 3.0 config
  format. Note that file-based configuration caches written by this version of
  the library are incompatible with previous versions, however this version may
  read caches generated by previous versions. This is because this version generates
  a stripped-down version of the "terse" configuration style.

* [major] Extended detailed error codes.
  These error codes expose more detail about the `NETWORK_ERROR` and
  `CONNECT_ERROR` codes returned by previous versions of the library. The extended
  codes are not returned by default and must be explicitly enabled in order to
  retain backwards compatibility with applications which rely on the older
  error codes.


**New Features in 2.4.0**

* [major] Connection Strings (aka "dsn") feature for instance creation. This adds a new
  version of the `lcb_create_st` structure which is passed a URI-like string
  rather than a semicolon-delimited list of hosts. This string is used to
  provide options and the list of hosts that the library should connect to.
  For example, `couchbase://default/localhost&compression=off`

* [major] SSL transport support for Couchbase 3.0 Enterprise.
  Couchbase 3.0 enterprise features the ability to encrypt communications
  between the client and the server using the SSL protocol. SSL protocol
  support in _libcouchbase_.

* [major] Retry queue for failed operations. The retry queue is used
  as a place to place operations which have failed internally and which
  should be retried within a certain amount of time. This also provides
  options on which commands should be retried.

* [minor] Compression/JSON flag (aka Datatype) support
  This adds support for a future feature of Couchbase server which will
  feature transparent compression. This feature also allows the server
  to signal to the library if a document is JSON or not. The compression
  feature may be disabled at compile-time, and may also be modified at
  runtime by setting `compression=off` in either the connection string
  or via `lcb_cntl_setstring(instance, "compression", "off")`

* [major] Experimental _scheduling_ API. This API replaces most of the older
  operation APIs with a scheduling API. These APIs are called with one
  command at a time and insert the resultant packet into a pipeline. The
  user may "schedule" the commands or "fail" the pipeline if a certain
  request has failed to be scheduled.

  This API also provides a common ABI header for commands so that they may
  easily be used via type-punning, or wrapped as a class hierarchy in C++.

  This API is currently considered volatile but will be the basis of the
  upcoming libcouchbase 3.0 API. The header file is `<libcouchbase/api3.h>`

* [major] Raw memcached packets may be sent to the library and have a callback
  invoked when their responses have been received.
  This adds an `lcb_pktfwd3()` API. This requires the new scheduling API.


**Bug Fixes in 2.4.0**

* [major] _select_ plugin may endlessly loop in some cases
  The plugin may loop if there was a long timeout from the
  future .

* [major] Do not break TCP connections on topology changes unless ejected from
  cluster. This ensures that nodes which are still part of the cluster have their
  TCP connections remain in tact despite being shifted in their server index values.
  Packets which have been sent to the wrong vBucket are silently ignored and
  rescheduled to their appropriate destination. This decreases load significantly
  on the client, network, and cluster during topology changes.

* [major] Use new-style "Terse" URI format when requesting a configuration over HTTP.
  This uses the HTTP configuration format over the new `/pools/default/bs/default`
  rather than the older `/pools/default/bucketsStreaming/default` form. The former
  form is much more efficient on the cluster side. If the new URI form is not
  supported (i.e. the server responds with an HTTP 404) the older form will be
  used instead. You may modify this behavior by setting the `LCB_CNTL_HTCONFIG_URLTYPE`
  setting via `lcb_cntl()`.

* [minor] The `cmake/configure` script now accepts the `LDFLAGS`, `CPPFLAGS`, `CFLAGS`,
  `CXXFLAGS`, `CC`, and `CXX` settings both within the environment _and_ the
  commandline, so the forms of `CC=clang ./cmake/configure` and
  `./cmake/configure CC=clang` are equivalent.

* [minor] The `pillowfight` tool will now print latencies between 1-10ms in resolutions
  of 100us.


**Metadata and Packaging Changes in 2.4.0**

* [major] Use Doxygen for API documentation.
  This replaces the _manpages_ for API documentation with Doxygen. Doxygen
  is a free and portable documentation system which may be obtained from your
  distribution or at [](http://doxygen.org). To generate the documentation
  from the source tree, simply run `doxygen` from the source root directory.
  To generate internal documentation, run `./docs/gen_internal_apidoc.sh`.

* [major] Add interface attributes to all API calls
  This properly documents all API calls with a certain API stability level
  such as _committed_ (for stable APIs), _uncomitted_ for APIs which may, but
  are not likely to change, and _volatile_ for APIs which are likely to be
  changed or removed.

* [major] Public header files have been reorganized
  This changes the layout of the header files from previous versions. This should
  not affect applications as applications should only ever include the main
  `<libcouchbase/couchbase.h>` file.

  the following files have been _removed_ from the
  `<libcouchbase/*>` header directory:

    * `types.h` - Merged into other header files
    * `arguments.h` - now a part of `couchbase.h`
    * `callbacks.h` - now a part of `couchbase.h`
    * `debug.h` - unused and obsolete
    * `durability.h` - now a part of `couchbase.h`
    * `behavior.h` - Merged into `deprecated.h`
    * `sanitycheck.h` - Merged into `deprecated.h`
    * `timings.h` - Part of `couchbase.h`
    * `compat.h` - Part of `deprecated.h`

  The following files have been _added_ into the `<libcouchbase/*>` directory.
  Unless otherwise noted, these files are included by `<libcouchbase/couchbase.h>`:

    * `api3.h` - Volatile proposed 3.0 API. **Not included by default**
    * `cxxwrap.h` - Contains the implementation for the deprecated C++ wrappers
    * `deprecated.h` - Contains deprecated APIs
    * `iops.h` - Contains the IO integration APIs
    * `pktfwd.h` - Contains the packet forwarding API. **Not included by default**
    * `vbucket.h` - Contains the vBucket mapping API. **Not included by default**

* OpenSSL is now a base dependency for the library. This may be disabled at configure
  time via `--enable-ssl=no`. See `./configure --help`.

* Snappy compression library is bundled and optionally compiled. This is left out by
  default as the configure script will search for a system installed `libsnappy`.
  Snappy provides the compression feature needed for compressing and inflating data
  between client and server. It may be disabled at compile-time via `--enable-snappy=no`

* [minor] _libvbucket_ has been fully integrated into libcouchbase from the forked
  _libvbucket_ package and, lives fully as part of the
  library. The public vBucket API may be found in `<libcouchbase/vbucket.h>`.

* [minor] As an alternative to the cross-platform `lcb_uintNN_t` typedefs, a shorter
  (and more standards compliant) alternative `lcb_UNN` typedefs are provided, thus
  instead of `lcb_uint32_t` you may use `lcb_U32`. The full listing of cross platform
  typdefs may be found inside `<libcouchbase/sysdefs.h>`



## 2.3.1 (2014-05-08)

* [major] CCBC-404: Segfault in `connmgr_invoke_request`
  Occasionally a segmentation fault would happen when a connection was being
  released as a result of a connection failure. This was because of invalid
  list tracking.

* [major] CCBC-395: Add `lcb_cntl()` interface for configuration cache
  Configuration cache options may be set after instantiation using `lcb_cntl()`
  with the new `LCB_CNTL_CONFIGCACHE` operation. The old-style `lcb_create_compat`
  creation path is deprecated.

* [major] CCBC-394: Get-with-replica occasionally crashes on Windows and UV
  during topology changes. This was due to not allocating a buffer if one did
  not exist.

* [major] CCBC-392: ABI compatibility broken between 2.x and 2.3 for
  `lcb_create_compat`. This has been fixed by symbol aliasing between versions.
  Developers are recommended to use the `lcb_cntl()` API to set the
  configuration cache, as specified in CCBC-395

* [major] CCBC-385: Failed assertion on get-with-replica when connection fails.
  If a connection fails with a `CMD_GET_REPLICA` command still in the queue an
  assertion failure will crash the library. This has been fixed by handling the
  opcode in the `failout_single_request` function.

* [major] CCBC-384: Unknown Winsock error codes crash application. This was fixed
  by providing proper handlers for Winsock codes which were not explicitly
  converted into their POSIX equivalents.

* [major] CCBC-376: Fix memory leak in configuration parsing. A leak was
  introduced in version 2.3.0 by not freeing the JSON pool structure. This has
  been fixed in 2.3.1

* [minor] CCBC-370: `lcb_get_host` and `lcb_get_port` may return host-port
  combinations from different servers. If multiple servers are listening on
  different ports this may result in yielding an invalid endpoint by combining
  the output from those two functions. This has been fixed in 2.3.1 by returning
  the host and port from the first host, in lieu of a currently-connected REST
  endpoint.

* [minor] CCBC-368: Initial bootstrapping failure may mask `LCB_BUCKET_ENOENT`
  calls with `LCB_ETIMEDOUT`. This has been fixed by not retrying configuration
  retrieval if an explicit HTTP 404 code is received. Note that when using
  bootstrap over memcached, a missing bucket may still be manifest as
  `LCB_AUTH_ERROR`.

* [minor] CCBC-367: Ensure `lcb_get_host` does not return `NULL` when the
  associated `lcb_t` is of `LCB_TYPE_CLUSTER`. This would cause crashes in some
  applications which relied on this function to not return `NULL`.

* [major] CCBC-389: Fixed Spurious timeouts being delivered in asynchronous
  use cases.
  In applications which do not use `lcb_wait()` the library will potentially
  time out commands internally triggering an erroneous configuration refresh.
  While this issue would not end up failing operations it will cause unnecessary
  network traffic for retrieving configurations. Applications using `lcb_wait()`
  are not affected as that function resets the timeout handler.

* [major] CCBC-332, CCBC-364: Compare configuration revision information
  for memcached cluster bootstrap. Previously we would refresh the
  configuration upon receipt
  of any new configuration update from memcached. This is fixed in 2.3.1 where
  the configuration will only be applied if it is deemed to be newer than the
  current configuration. With memcached bootstrap this is only true if the
  configuration's `rev` field is higher than the current one.


## 2.3.0 GA (2014-04-07)

* [major] CCBC-152: Provide a master-only observe option. This adds a new
  struct version to the `lcb_observe_cmd_t` which allows to select only the
  master node. One can use this to efficiently check if the key exists (without
  retrieving it). It also allows one to get the CAS of the item without fetching
  it.

* [major] CCBC-281: Fix partial scheduling during multi operations. Previously
  the library would deliver spurious callbacks  if multiple operations were
  scheduled with a single command and one of the operations could not be mapped
  to a server. This fixes this behavior and ensures that callbacks are only
  invoked for items if the entire API call succeeded.

* [major] CCBC-150: Multi-packet commands will no longer deliver spurious
  callbacks on failure. Previously these commands would be relocated to the
  same server during a configuration change, resulting in multiple callbacks
  for the same command. In this case the client would think all the commands
  had been completed, and when the next response arrived it would incorrectly
  map it to a different request.

* [minor] CCBC-327: Fix assumption of `vbucket_compare()` only returning if
  a diff exists. This function actually returns a non-NULL pointer always
  unless it cannot allocate more memory. This bug was introduced with the
  _DP1_ release.

* [minor] CCBC-326: Memcached buckets should use streaming config. This was
  left unchecked in the _DP1_ release and has now been fixed.

* [major] CCBC-351: Enhance performance for configuration parsing. In previous
  versions receiving multiple configurations at once would cause CPU spikes on
  slower systems. The configuration parser code has been optimized to alleviate
  this issue.

* [minor] CCBC-350: Provide `lcb_cntl()` API to retrieve the SCM changeset used
  by the currently loaded binary. This is a more effective way to get the
  revision as it does not depend on the specific headers the library was
  compiled with.

* [major] CCBC-340: Correctly parse `""`, `"0"` and `"1"` for environment
  variables. In previous versions having the entry set to an empty string
  or `0` would still be treated by the library as a true value for various
  environment variables. This has been fixed so that clear "False" values
  such as the empty string or 0 are treated as such.


## 2.3.0-dp1 (2014-02-04)

* [major] CCBC-234: Implementation of
  [Cluster Configuration Carrier Publication][cccp-wiki]. This is the new and
  more efficient way to bootstrap from a cluster using the native memcached
  protocol and is quicker than the previous HTTP bootstrap mechanism, dramatically
  improving startup times and reducing load on the server. This feature is
  available in server verions 2.5 and greater. The existing HTTP configuration is
  still supported and will be employed as a fallback in the event that `CCCP`
  is not supported.

  In conjunction with this, a new struct version has been added to the
  `lcb_create_st` parameters structure for use with `lcb_create`. This allows
  you to get more control over how the client is initialized:

    lcb_t instance;
    struct lcb_create_st options;
    lcb_config_transport_t enabled_transports = {
        LCB_CONFIG_TRANSPORT_CCCP,
        LCB_CONFIG_TRANSPORT_LIST_END
    };

    memset(&options, 0, sizeof(options));
    options.version = 2;
    options.v.v2.mchosts = "example.com:11210";
    options.v.v2.transports = enabled_transports;

    lcb_error_t rc = lcb_create(&instance, &options);
    if (rc != LCB_SUCCESS) {
        fprintf(stderr, "Failed to create instance: %s\n", lcb_strerror(instance, rc));
    }

  The above snippet will configure a client to _always_ use the `CCCP` protocol
  and never attempt to fall back on HTTP

  The CCCP implementation required a significant rewrite in how sockets were
  created and re-used. Particularly, a connection pooling feature was implemented.

  Additionally, the `cbc` command now has an additional `-C` option which accepts
  the preferred configuration mechanism to use.

* [major] CCBC-305: Implement logging hooks.

  This improvements adds various levels of diagnostic logging with the library
  itself. It may be utilized via the environment (by setting the `LCB_LOGLEVEL`
  environment variable to a positive integer -- the higher the number the more
  verbose the logging).

  Integrators may also use the logging API specified in `<libcouchbase/types.h>`
  to proxy the library's logging messages into your own application.

  Current events logged include connection initialization, destruction, connection
  pool management, configuration changes, and timeouts.

  By default the library is silent.

* [major] CCBC-316: Allow per-node bootstrap/config timeouts.
  This change allows more finer grained control over how long to wait per-node
  to receive updated configuration info. This setting helps adjust the initial
  and subsequent bootstrap processes to help ensure each node gets a slice of
  time.

* [major] CCBC-297: Handle spurious EWOULDBLOCK on UV/Win32
  This issue caused odd errors on Windows when large amounts of data
  would be received on the socket.

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
  connection is broken again immediately, `relocate_packets()` will go
  to wrong path.

* [major] CCBC-202 Don't try to switch to backup nodes when timeout is
  reached

* [major] CCBC-188 Check if SASL struct is valid before disposing

* [major] Fix compile error with sun studio
  "src/event.c", line 172: error: statement not reached (`E_STATEMENT_NOT_REACHED`)

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
  caching. See man `lcb_create_compat()`

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
  `lcb_t`)

* [minor] Add a new library: `libcouchbase_debug.so` (see
  include/libcouchbase/debug.h) which is a new library that contains
  new debug functionality.

* [minor] Added manual pages for the library

* [major] CCBC-153 Reset internal state on `lcb_connect()`. Allow caller
  to use `lcb_connect()` multiple times to implement reconnecting using
  the same `lcb_t` instance. Also it sets up the initial-connection
  timer for users who don't use `lcb_wait()` and drive IO loop manually.

* [major] CCBC-171 Invalid read in libevent plugin, when the plugin
  compiled in 1.x mode

* [critical] CCBC-155 Observe malfunctions in the case of multiple
  keys and server failure

* [major] CCBC-156 The ep-engine renders meaningful body for observe
  responses only if status code is 0 (`PROTOCOL_BINARY_RESPONSE_SUCCESS`).
  We shouldn't interpret response body in other cases, just decode &
  failout request instead. Also we shouldn't retry observe commands on
  `PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET`, because it can cause the
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

* [minor] Document `LCB_SERVER_BUG` and `LCB_PLUGIN_VERSION_MISMATCH`.
  Enhance the the `lcb_strerror()` test to detect undocumented error
  codes.

* [critical] CCBC-153 Under high load the library could generate
  `LCB_ETIMEDOUT` errors without reason owing to internal limitations.

## 2.0.1 (2012-12-11)

50 files changed, 1009 insertions(+), 274 deletions(-)

* libev-plugin: delay all timers while the loop isn't active. It will
  fix `LCB_ETIMEOUT` in the following scenario:

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

* CCBC-120 Reformat and refactor `lcb_server_purge_implicit_responses`:

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

* CCBC-118 `lcb_error_t` member in the http callbacks shouldn't reflect
  the HTTP response code. So the error code will be always `LCB_SUCCESS`
  if the library managed to receive the data successfully.

* Timer in libev uses double for interval. Ref:
  [](http://pod.tst.eu/http://cvs.schmorp.de/libev/ev.pod#code_ev_timer_code_relative_and_opti)

* CCBC-115 Return zero from `do_read_data()` if `operations_per_call`
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
  `lcb_server_send_packets()` function later check if the server object
  connected and establish connection if not (with raising possible
  errors)

* Try all known plugins for `LCB_IO_OPS_DEFAULT` in run time

* Don't use the `time_t` for win32. When compiling from php it turns out
  that it gets another size of the `time_t` type, causing the struct
  offsets to differ.

* Add `lcb_verify_compiler_setup()`. This function allows the "user" of
  the library to verify that the compiler use a compatible struct
  packing scheme.

* CCBC-87: Add documentation about the error codes

## 2.0.0beta2 (2012-10-12)

81 files changed, 2822 insertions(+), 1353 deletions(-)

* Search ev.h also in ${includedir}/libev

* Fix SEGFAULT if IO struct is allocated not by the `lcb_create()`

* Allow libcouchbase to connect to an instance without specifying bucket. It is useful
  when the bucket not needed, e.g. when performing administration
  tasks.

* Fix memory leak after an unsuccessful connection

* Fix invalid memory access in cbc tool. Affected command is
  cbc-bucket-create

* `lcb_create`: replace `assert()` with error code

* CCBC-105 breakout event loop in default `error_callback`. This provides
  better default behaviour for users who haven't defined global error
  callback.

* Allow users to build the library without dependencies. For example,
  without plugins at all. This may be useful if the plugin is
  implemented by or built into the host application.

* Allow users to install both libraries (2.x and 1.x) on the same system.

* Make the content type optional for `lcb_make_http_request()`

* Fix password memory leak in http.c (7e71493)

* Add support for raw http requests. libcouchase already contains all
  the bits to execute a raw http request, except for the possibility
  to specify a host:port, username and password.

* Cleanup HTTP callbacks. Use the same callbacks both for Management
  and View commands, and rename them to `lcb_http_complete_callback` and
  `lcb_http_data_callback`.

* Allow users to use environment variables to pick the event plugin

* Add a new interface version for creating IO objects via plugins

* Implement a new libev plugin. It is compatible with both libev3 and
  libev4.

* CCBC-103: Fix linked event/timer lists for win32

* Allow to disable CXX targets

* `lcb_connect()` should honor the syncmode setting. Automatically call
  `lcb_wait()` when in synchronous mode

## 2.0.0beta (2012-09-13)

123 files changed, 13753 insertions(+), 8264 deletions(-)

* Refactor the API. This is a full redesign of the current
  libcouchbase API that'll allow us to extend parts of the API without
  breaking binary compatibility. Also it renames all functions to have
  `lcb_` prefix instead of `libcouchbase_` and `LCB`/`LIBCOUCHBASE` in macros.

* Added --enable-fat-binary. Helps to solve issues when linking with
  fat binaries on MacOS.

* Implement getter for number of nodes in the cluster:
  `lcb_get_num_nodes()`

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

* Add `lcb_get_server_list`

* Merge `lcb_get_locked` into `lcb_get` function

* Fix Windows build

* Include sys/uio.h. Needed by OpenBSD

* Fix mingw build (c394a1c)

* CCBC-80: Default to IPv4 only

* Sync `memcached/protocol_binary.h`. Pull extra
  `protocol_binary_datatypes` declarations.

* Deliver HTTP headers via callbacks

* Unify HTTP interface. This means massive rename of the symbols

* CCBC-92 release ringbuffer in `lcb_purge_single_server`

* CCBC-91 Fix switching to backup node in case of server outage

* CCBC-91 Reset timer for commands with `NOT_MY_VBUCKET` response

* Fix alignment for sparc platforms

* Fix win32 build (Add strings.h)

* Fix build with libyajl available

* Bundle libvbucket

* Fix a problem with allocating too few slots in the `backup_nodes`. Fixes
  illegal memory access.

* CCBC-90 Fix initialization of backup nodes array. The code switching
  nodes relies on NULL terminator rather than `nbackup_nodes` variable.
  Fixes illegal memory access.

* CCBC-89: Release the memory allocated by the http parser

## 1.0.6 (2012-08-30)

5 files changed, 18 insertions(+), 5 deletions(-)

* CCBC-92 release ringbuffer in `libcouchbase_purge_single_server`

## 1.0.5 (2012-08-15)

6 files changed, 23 insertions(+), 15 deletions(-)

* CCBC-91 Fix switching to backup node in case of server outage

* CCBC-91 Reset timer for commands with `NOT_MY_VBUCKET` response

## 1.1.0dp9 (2012-07-27)

5 files changed, 18 insertions(+), 11 deletions(-)

* Render auth credentials for View requests.
  `libcouchbase_make_http_request()` won't accept credentials anymore.
  It will pick them bucket configuration.

## 1.1.0dp8 (2012-07-27)

36 files changed, 2093 insertions(+), 704 deletions(-)

* Allow the client to specify the verbosity level on the servers using
  `lcb_set_verbosity()` function.

* Bind timeouts to server sockets instead of commands. This means that
  from this point timeout interval will be started from the latest IO
  activity on the socket. This is a behavior change from the 1.0 series.

* Allow the user to get the number of replicas using
  `libcouchbase_get_num_replicas()`

* Allow a user to breakout from the event loop in callbacks using
  `libcouchbase_breakout()`

* Make `libcouchbase_wait()` re-entrable

* Let users detect if the event loop running already using
  `libcouchbase_is_waiting()` function.

* CCBC-77 Use separate error code for ENOMEM on the client

* CCBC-82 Implement read replica

* CCBC-85 Implement general purpose timers. It is possible for users
  to define their own timers using `libcouchbase_timer_create()`
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
  `libcouchbase_set_configuration_callback()`, and be notified about all
  configuration changes.

* Implement function to execution management requests. Using
  `libcouchbase_make_management_request()` function you can configure
  the cluster, add/remove buckets, rebalance etc. It behaves like
  `libcouchbase_make_couch_request()` but works with another endpoint.

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
  * Define `size_t` types to fix MSVC 9 build
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

* CCBC-68 Implement `UNLOCK_KEY` (`UNL`) command

* CCBC-68 Implement `GET_LOCKED` (`GETL`) command

* hashset.c: iterate over whole set on rehashing. Fixes memory leaks
  related to hash collisions (905ef95)

* Destroy view requests items when server get destroyed

* Do not call View callbacks for cancelled requests

* Fix `ringbuffer_memcpy()` (36afdb2)

* CCBC-62 A hang could occur in `libcouchbase_wait()` after the timeout
  period. Check for breakout condition after purging servers

* CCBC-65 A small memory leak can occur with frequent calls to
  `libcouchbase_create()` and `libcouchbase_destroy()`

* CCBC-64. Timeouts can occur during topology changes, rather than be
  correctly retried. Send the retry-packet to new server

* `vbucket_found_incorrect_master()` returns server index

* Fix `ringbuffer_is_continous()`

* Pick up cookies from pending buffer unless node connected

* RCBC-33 A fix for a buffer overflow with the supplied password as
  has been integrated. While it is a buffer overflow issue, this is
  not considered to be a possible security issue because the password
  to the bucket is not commonly supplied by an untrusted source

## 1.0.4 (2012-06-01)

15 files changed, 330 insertions(+), 76 deletions(-)

* CCBC-65 A small memory leak can occur with frequent calls to
  `libcouchbase_create()` and `libcouchbase_destroy()`

* CCBC-62 A hang could occur in `libcouchbase_wait()` after the timeout
  period. Check for breakout condition after purging servers

* CCBC-64. Timeouts can occur during topology changes, rather than be
  correctly retried. Send the retry-packet to new server

* [backport] `vbucket_found_incorrect_master()` returns server index.
  (orig: c32fdae)

## 1.0.3 (2012-05-02)

6 files changed, 44 insertions(+), 7 deletions(-)

* [backport] Fix `ringbuffer_is_continous()` (orig: 9cfda9d)

* [backport] Pick up cookies from pending buffer unless node connected
  (orig: 463958d)

* RCBC-33 A fix for a buffer overflow with the supplied password as
  has been integrated. While it is a buffer overflow issue, this is
  not considered to be a possible security issue because the password
  to the bucket is not commonly supplied by an untrusted source

## 1.1.0dp2 (2012-04-10)

10 files changed, 54 insertions(+), 20 deletions(-)

* CCBC-59 Don't wait for empty buffers. If called with no operations
  queued, `libcouchbase_wait()` will block forever. This means that a
  single threaded application that calls `libcouchbase_wait()` at
  different times to make sure operations are sent to the server runs
  the risk of stalling indefinitely. This is a very likely scenario.

* Don't define `size_t` and `ssize_t` for VS2008

* Fix segfault while authorizing on protected buckets (211bb04)

## 1.1.0dp (2012-04-05)

59 files changed, 4374 insertions(+), 1205 deletions(-)

* This release adds new functionality to directly access Couchbase
  Server views using the `libcouchbase_make_couch_request()` function.
  See the associated documentation and header files for more details

* Check for newer libvbucket

* MB-4834: Request the tap bytes in a known byte order (adf2b30)

## 1.0.2 (2012-03-06)

83 files changed, 4095 insertions(+), 654 deletions(-)

* Implement VERSION command from binary protocol

* Allow use of libcouchbase to pure memcached clusters by using
  `libcouchbase_create_compat()` function

* Always sign deb packages and allow to pass PGP key

* Bundle the protocol definitions for memcached
  (`memcached/protocol_binary.h` and `memcached/vbucket.h`) to make it
  easier to build

* Bundle sasl client implementation

* Fix windows build for MS Visual Studio 9

  * define `E*` if missing
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

* Handle `PROTOCOL_BINARY_RESPONSE_NOT_MY_VBUCKET` and retry it until
  success or another error, which can be handled by caller

* Do not attempt SASL when SASL already in progress

* Finer grained error reporting for basic REST errors:

  * return `LIBCOUCHBASE_AUTH_ERROR` on HTTP 401
  * return `LIBCOUCHBASE_BUCKET_ENOENT` on HTTP 404
  * event loop is stopped (via `maybe_breakout`) on REST error

* Fixed segfaults and memory access errors on libevent1.4

* Allow for notification on initial vbucket config. This makes
  libcouchbase `stop_event_loop` and libcouchbase maybe breakout work
  properly in cooperative asynchronous event loops. the wait flag is
  set by `libcouchbase_wait()` and unset by `maybe_breakout`.
  Additionally, `breakout_vbucket_state_listener` will call
  `maybe_breakout` as well, instead of having synchronous behavior
  assumed by `libcouchbase_wait()`

* Fix `sasl_list_mech_response_handler()`. `sasl_client_start()` expects
  null-terminated string

* Refactor: use `libcouchbase_xxxx` for the datatypes

* Do not notify user about the same error twice. Use command callback
  when it's possible. (e.g. where the `libcouchbase_server_t` is
  accessible and we can `libcouchbase_failout_server()`)

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

* New command cbc. This command intended as the analog of `mem*`
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

* Use ringbuffers instead `buffer_t`

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

* MB-3294 Added `_by_key` functions

* CCBC-5 Fixed abort in `do_read_data` (c=0x7b09bf0) at src/event.c:105

* Added timings API. It might be possible to turn on timing collection
  using `libcouchbase_enable_timings()`/`libcouchbase_disable_timings()`,
  and receive the data in timings callback.

* Basic TAP protocol implementation

* Initial win32 support


