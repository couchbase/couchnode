# cbc-pillowfight(1) - Stress Test for Couchbase Client and Cluster

## SYNOPSIS

`cbc-pillowfight` [_OPTIONS_]

## DESCRIPTION

`cbc-pillowfight` creates a specified number of threads each looping and
performing get and set operations within the cluster.

The stress test operates in the following order

1. It will pre-load the items in the cluster (set by the `--num-items` option)

2. Once the items are all loaded into the cluster, it will access all the items
(within the `--num-items`) specification, using a combination of storage and
retrieval operations (the proportion of retrieval and storage operations are
controlled via the `--set-pct` option).

3. Operations are scheduled in _batches_. The batches represent a single pipeline
(or network buffer) which is filled with a certain amount of operations (see the
`--batch-size` option). These batch sizes are then sent over to the cluster and
the requests are serviced by it.


### Tuning

Getting the right benchmark numbers highly depends on the type of environment
the client is being run in. The following provides some information about
specific settings which may make `pillowfight` generate more operations.

* Increasing the batch size will typically speed up operations, but increasing
  the batch size too much will actually slow it down. Additionally, very high
  batch sizes will cause high memory usage.

* Adding additional threads will create additional client objects and connections,
  potentially increasing performance. Adding too many threads will cause local
  and network resource congestion.

* Decreasing the item sizes (the `--min-size` and `--max-size` options) will
  always yield higher performance in terms of operationd-per-second.

* Limiting the working set (i.e. `--num-items`) will decrease the working set
  within the cluster, thereby increasing the chance that a given item will be
  inside the server's CPU cache (which is extremely fast), rather than in main
  memory (slower), or disk (much slower)

The benchmark tool sets up SIGQUIT (CTRL-/) handler and dumps useful diagnostics
and metrics to STDERR on this signal.

## OPTIONS

Options may be read either from the command line, or from a configuration file
(see cbcrc(4)):

The following options control workload generation:

* `-B`, `--batch-size`=_BATCHSIZE_:
  This controls how many commands are scheduled per cycles. To simulate one operation
  at a time, set this value to 1.

* `-I`, `--num-items`=_NUMITEMS_:
  Set the _total_ number of items the workload will access within the cluster. This
  will also determine the working set size at the server and may affect disk latencies
  if set to a high number.

* `-p`, `--key-prefix`=_PREFIX_:
  Set the prefix to prepend to all keys in the cluster. Useful if you do not wish the items
  to conflict with existing data.

* `-t`, `--num-threads`=_NTHREADS_:
  Set the number of threads (and thus the number of client instances) to run
  concurrently. Each thread is assigned its own client object.

* `-r`, `--set-pct`=_PERCENTAGE_:
  The percentage of operations which should be mutations. A value of 100 means
  only mutations while a value of 0 means only retrievals.

* `-n`, `--no-population`:
  By default `cbc-pillowfight` will load all the items (see `--num-items`) into
  the cluster and then begin performing the normal workload. Specifying this
  option bypasses this stage. Useful if the items have already been loaded in a
  previous run.

* `--populate-only`:
  Stop after population. Useful to populate buckets with large amounts of data.

* `-m`, `--min-size`=_MINSIZE_:
* `-M`, `--max-size`=_MAXSIZE_:
  Specify the minimum and maximum value sizes to be stored into the cluster.
  This is typically a range, in which case each value generated will be between
  `--min-size` and `--max-size` bytes.

* `-E`, `--pause-at-end`:
  When the workload completes, do not exit immediately, but wait for user input.
  This is helpful for analyzing open socket connections and state.

* `-c`, `--num-cycles`:
  Specify the number of times the workload should cycle. During each cycle
  an amount of `--batch-size` operations are executed. Setting this to `-1`
  will cause the workload to run infinitely.

* `--sequential`:
  Specify that the access pattern should be done in a sequential manner. This
  is useful for bulk-loading many documents in a single server.

* `--start-at`:
  This specifies the starting offset for the items. The items by default are
  generated with the key prefix (`--key-prefix`) up to the number of items
  (`--num-items`). The `--start-at` value will increase the lower limit of
  the items. This is useful to resume a previously cancelled load operation.

* `-T`, `--timings`:
  Enabled timing recorded. Timing histogram will be dumped to STDERR on SIGQUIT
  (CTRL-/). When specified second time, it will dump a histogram of command
  timings and latencies to the screen every second.

* `-e`, `--expiry`=_SECONDS_:
  Set the expiration time on the document for _SECONDS_ when performing each
  operation. Note that setting this too low may cause not-found errors to
  appear on the screen.

* `-U`, `--spec`=_SPEC_:
  A string describing the cluster to connect to. The string is in a URI-like syntax,
  and may also contain other options. See the [EXAMPLES](#examples) section for information.
  Typically such a URI will look like `couchbase://host1,host2,host3/bucket`.

  The default for this option is `couchbase://localhost/default`

* `-P`, `--password`=_SASLPASS_:

* `-P -`, `--password=-`:
  Specify the SASL password for the bucket. This is only needed if the bucket is
  protected with a password. Note that this is _not_ the administrative password
  used to log into the web interface.

  Specifying the `-` as the password indicates that the program should prompt for the
  password. You may also specify the password on the commandline, directly,
  but is insecure as command line arguments are visible via commands such as `ps`.

* `-T`, `--timings`:
  Dump command timings at the end of execution. This will display a histogram
  showing the latencies for the commands executed.

* `-v`, `--verbose`:
  Specify more information to standard error about what the client is doing. You may
  specify this option multiple times for increased output detail.

* `-D`, `--cparam`=OPTION=VALUE:
  Provide additional client options. Acceptable options can also be placed
  in the connection string, however this option is provided as a convenience.
  This option may be specified multiple times, each time specifying a key=value
  pair (for example, `-Doperation_timeout=10 -Dconfig_cache=/foo/bar/baz`).
  See [ADDITIONAL OPTIONS](#additional-options) for more information

* `p`, `--persist-to`=_NUMNODES_:
  Wait until the item has been persisted to at least `NUMNODES` nodes' disk. If
  `NUMNODES` is 1 then wait until only the master node has persisted the item for
  this key. You may not specify a number greater than the number of nodes actually
  in the cluster. `-1` is special value, which mean to use all available nodes.

* `r` `--replicate-to`=_NREPLICAS_:
  Wait until the item has been replicated to at least `NREPLICAS` replica nodes.
  The bucket must be configured with at least one replica, and at least `NREPLICAS`
  replica nodes must be online. `-1` is special value, which mean to use all
  available replicas.

* `--lock`=_TIME_:
  This will retrieve and lock an item before update, making it inaccessible for
  modification until the update completed, or `TIME` has passed.

* `-y`, `--compress`:
  Enable compressing of documents. When library compiled with compression
  support, this option will enable Snappy compression for outgoing data.
  Incoming compressed data handled automatically regardless of this option.
  Note, that because the compression support have to be negotiated with the
  server, first packets might be sent uncompressed even when this switch
  was specified. This is because the library might queue data commands before
  socket connection has been established, and the library will negotiate
  compression feature. If it is known that all server support compression
  repeating the switch (like `-yy`) will force compression for all outgoing
  mutations, even scheduled before establishing connection.

* `--json`:
  Make `pillowfight` store document as JSON rather than binary. This will
  allow the documents to nominally be analyzed by other Couchbase services
  such as Query and MapReduce.

  JSON documents are created by creating an empty JSON object (`{}`) and then
  repeated populating it with `Field_%d` property names (where `%d` is `1` and
  higher), and setting its value to a repeating asterisk `*` up to 16 times:

        {
            "Field_1": "****************",
            "Field_2": "****************",
            "Field_3": "****************",
            "Field_4": "****************",
            "Field_5": "********"
        }

  When using document size constraints, be aware that the minimum and maximum
  sizes (`--min-size` and `--max-size`) are not strict limits, and that the
  resultant sizes may be bigger or smaller by a few bytes in order to satisfy
  the requirements of proper JSON syntax.

* `--noop`:
  Use couchbase NOOP operations when running the workload. This mode ignores
  population, and all other document operations. Useful as the most lightweight
  workload.

* `--subdoc`:
  Use couchbase sub-document operations when running the workload. In this
  mode `pillowfight` will use Couchbase
  [sub-document operations](http://blog.couchbase.com/2016/february/subdoc-explained)
  to perform gets and sets of data. This option must be used with `--json`

* `--pathcount`:
  Specify the number of paths a single sub-document operation should contain.
  By default, each subdoc operation operates on only a single path within the
  document. You can specify multiple paths to atomically executed multiple
  subdoc operations within a single command.

  This option does not affect the `--batch-size` option as a subdoc command
  is considered as a single command (with respect to batching) regardless of
  how many operations it contains.

<a name="additional-options"></a>
## ADDITIONAL OPTIONS

The following options may be included in the connection string (via the `-U`
option) as URI-style query params (e.g.
`couchbase://host/bucket?option1=value1&option2=value2`) or as individual
key=value pairs passed to the `-D` switch (e.g. `-Doption1=value1
-Doption2=value`). The `-D` will internally build the connection string,
and is provided as a convenience for options to be easily passed on the
command-line

* `operation_timeout=SECONDS`:
  Specify the operation timeout in seconds. This is the time the client will
  wait for an operation to complete before timing it out. The default is `2.5`
* `config_cache=PATH`:
  Enables the client to make use of a file based configuration cache rather
  than connecting for the bootstrap operation. If the file does not exist, the
  client will first connect to the cluster and then cache the bootstrap information
  in the file.
* `truststorepath=PATH`:
  The path to the server's SSL certificate. This is typically required for SSL
  connectivity unless the certificate has already been added to the openssl
  installation on the system (only applicable with `couchbases://` scheme)
* `certpath=PATH`:
  The path to the server's SSL certificate. This is typically required for SSL
  connectivity unless the certificate has already been added to the openssl
  installation on the system (only applicable with `couchbases://` scheme).
  This also should contain client certificate when certificate authentication
  used, and in this case other public certificates could be extracted into
  `truststorepath` chain.
* `keypath=PATH`:
  The path to the client SSL private key. This is typically required for SSL
  client certificate authentication. The certificate itself have to go first
  in chain specified by `certpath` (only applicable with `couchbases://` scheme)
* `ssl=no_verify`:
  Temporarily disable certificate verification for SSL (only applicable with
  `couchbases://` scheme). This should only be used for quickly debugging SSL
  functionality.
* `sasl_mech_force=MECHANISM`:
  Force a specific _SASL_ mechanism to be used when performing the initial
  connection. This should only need to be modified for debugging purposes.
  The currently supported mechanisms are `PLAIN` and `CRAM-MD5`
* `bootstrap_on=<both,http,cccp>`:
  Specify the bootstrap protocol the client should use when attempting to connect
  to the cluster. Options are: `cccp`: Bootstrap using the Memcached protocol
  (supported on clusters 2.5 and greater); `http`: Bootstrap using the HTTP REST
  protocol (supported on any cluster version); and `both`: First attempt bootstrap
  over the Memcached protocol, and use the HTTP protocol if Memcached bootstrap fails.
  The default is `both`

## EXAMPLES

### CONNECTION EXAMPLES

The following examples show how to connect `pillowfight` to different types
of cluster configurations.

Run against a bucket (`a_bucket`) on a cluster on a remote host:

    cbc cat key -U couchbase://192.168.33.101/a_bucket

Connect to an SSL cluster at `secure.net`. The certificate for the cluster is
stored locally at `/home/couchbase/couchbase_cert.pem`:

    cbc cat key -U couchbases://secure.net/topsecret_bucket?certpath=/home/couchbase/couchbase_cert.pem

Connect to an SSL cluster at `secure.net`, ignoring certificate verification.
This is insecure but handy for testing:

    cbc cat key -U couchbases://secure.net/topsecret_bucket?ssl=no_verify

Connect to a password protected bucket (`protected`) on a remote host:

    cbc cat key -U couchbase://remote.host.net/protected -P -
    Bucket password:
    ...

Connect to a password protected bucket, specifying the password on the
command line (INSECURE, but useful for testing dummy environments)

    cbc cat key -U couchbase://remote.host.net/protected -P t0ps3cr3t

Connect to a bucket running on a cluster with a custom REST API port

    cbc cat key -U http://localhost:9000/default

Connec to bucket running on a cluster with a custom memcached port

    cbc cat key -U couchbase://localhost:12000/default

Connect to a *memcached* (http://memcached.org)
cluster using the binary protocol. A vanilla memcached cluster is not the same
as a memcached bucket residing within a couchbase cluster (use the normal
`couchbase://` scheme for that):

    cbc cat key -U memcached://host1,host2,host3,host4

Connect to an SSL cluster at `secure.net`:

    cbc-pillowfight -U couchbases://secure.net/topsecret_bucket


Run against a bucket (`a_bucket`) on a cluster on a remote host:

    cbc-pillowfight -U couchbase://192.168.33.101/a_bucket

### BENCHMARK EXAMPLES

The following examples show how to configure different types of workloads with
pillowfight.

Run with 20 threads/instances, each doing one operation at a time:

    cbc-pillowfight -t 20 -B 1

Run 100 iterations of 2MB item sizes, using a dataset of 50 items

    cbc-pillowfight -M $(1024*1024) -m $(1024*1024) -c 100 -I 50

Use JSON documents of 100k each

    cbc-pillowfight --json -m 100000 -M 100000

Stress-test sub-document mutations

    cbc-pillowfight --json --subdoc --set-pct 100


## TODO

Rather than spawning threads for multiple instances, offer a way to have multiple
instances function cooperatively inside an event loop.

## BUGS

This command's options are subject to change.

## SEE ALSO

cbc(1), cbcrc(4)

## HISTORY

The `cbc-pillowfight` tool was first introduced in libcouchbase 2.0.7
