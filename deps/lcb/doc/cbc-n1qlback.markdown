# cbc-n1qlback(1) - Stress Test for Couchbase Query (N1QL)

## SYNOPSIS

`cbc-n1qlback` -f QUERYFILE [_OPTIONS_]

## DESCRIPTION

`cbc-n1qlback` creates a specified number of threads each executing a set
of user defined queries.

`cbc-n1qlback` requires that it be passed the path to a file containing
the queries to execute; one per line. The query should be in the format of
the actual HTTP POST body (in JSON format) to be sent to the server.
For simple queries, only the `statement` field needs to be set:

    {"statement":"SELECT country FROM `travel-sample`"}
    {"statement":"SELECT country, COUNT(country) FROM `travel-sample` GROUP BY country"}


For more complex queries (for example, placeholders, custom options), you may
refer to the N1QL REST API reference.

`n1qlback` requires that any resources (data items, indexes) are already
defined.

## OPTIONS

The following options control workload generation:

* `-f` `--queryfile`=_PATH_:
  Path to a file containing the query bodies to execute in JSON format, one
  query per line. See above for the format.

* `-t`, `--num-threads`=_NTHREADS_:
  Set the number of threads (and thus the number of client instances) to run
  concurrently. Each thread is assigned its own client object.


The following options control how `cbc-n1qlback` connects to the cluster

* `-U`, `--spec`=_SPEC_:
  A string describing the cluster to connect to. The string is in a URI-like syntax,
  and may also contain other options. See the [EXAMPLES](#examples) section for information.
  Typically such a URI will look like `couchbase://host1,host2,host3/bucket`.

  The default for this option is `couchbase://localhost/default`

* `-u`, `--username`=_USERNAME_:
  Specify the _username_ for the bucket. As of Couchbase Server 2.5 this field
  should be either left empty or set to the name of the bucket itself.

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

* `-e`, `--error-log`=_PATH_:
  Path to a file, where the command will write failed queries along with error details.
  Use this option to figure out why `ERRORS` metric is not zero.

* `-D`, `--cparam`=OPTION=VALUE:
  Provide additional client options. Acceptable options can also be placed
  in the connection string, however this option is provided as a convenience.
  This option may be specified multiple times, each time specifying a key=value
  pair (for example, `-Doperation_timeout=10 -Dconfig_cache=/foo/bar/baz`).
  See [ADDITIONAL OPTIONS](#additional-options) for more information

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

The following will create a file with 3 queries and 5 threads alternating
between them. It also creates indexes on the `travel-sample` bucket

    cbc n1ql -U couchbase://192.168.72.101/a_bucket 'CREATE INDEX ix_name ON `travel-sample`(name)'
    cbc n1ql -U couchbase://192.168.72.101/a_bucket 'CREATE INDEX ix_country ON `travel-sample`(country)'

    cat queries.txt <<EOF
    {"statement":"SELECT country FROM `travel-sample` WHERE `travel-sample`.country = \"United States\""}
    {"statement":"SELECT name FROM `travel-sample` LIMIT 10"}
    {"statement":"SELECT country, COUNT(country) FROM `travel-sample` GROUP BY country"}
    EOF

    cbc-n1qlback -U couchbase://192.168.72.101/a_bucket -t 5 -f queries.txt

## BUGS

This command's options are subject to change.

## SEE ALSO

cbc(1), cbc-pillowfight(1), cbcrc(4)

## HISTORY

The `cbc-n1qlback` tool was first introduced in libcouchbase 2.4.10
