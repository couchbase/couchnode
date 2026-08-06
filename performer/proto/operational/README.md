# GRPC format
References:
* https://developers.google.com/protocol-buffers/docs/proto3

## Rules for Performers
The 'golden rule' is that the performer is meant to be a dumb-as-rocks passthrough agent.  If there is something in the
FIT GRPC that it cannot handle, please raise it with SDKQE to explore options, rather than trying to interpret or 
manipulate it into something it or the SDK can use.  With that in mind:

1. The performer should pass all fields to the SDK directly.
   For instance, some performers were prepending "couchbase://" to the connection string, which a) masked an SDK bug and
   b) caused problems when the driver did start sending the connection string.
   If passing fields to the SDK causes an issue then raise with SDKQE to explore options.

2. If the performer gets an RPC or parameter that either it or the SDK can't do anything with, or doesn't recognise, then
   raise with SDKQE to explore options.  If they find there a reasonable case for the SDK not being able to handle 
   something (remember that we want all SDKs to be consistent), then the performer should raise UNSUPPORTED if it receives it.
   This may require appropriate driver-side logic to be added.
   The performer should also raise UNSUPPORTED as the default on any `oneof` handling.

3. Many fields are `optional`, especially configuration ones.  These help test default options.  If a configuration block
   is optional and not provided, then the performer should call the appropriate no-option overload - e.g.
   `cluster.query(statement)` rather than `cluster.query(statement, options)`.

## Packages
The following rules are used for packages:

1. A flat directory structure is used so performers can pull in all protobuf files easily.
2. As a replacement for a directory structure, the filename includes the package name.  E.g. `sdk.kv.options.proto` which is in package `protocol.sdk.kv`.
3. The "protocol.shared" package is used for all shared/base code: anything that could be shared between SDK and transactions, for instance.
4. Otherwise aim to put new GRPC into a package, or create a package.  Most will go under `sdk`, e.g. `sdk.query`.
5. Avoid import package cycles (see below) to allow Go to compile.
6. We use 'sdk.kv.Get' naming, rather than say 'sdk.kv.SdkKvGet'.
   6.1. One exception to this are transactions, e.g. `transactions.TransactionResult`.  These messages existed prior to this rule, and to reduce breakage, they were not renamed.
7. Don't have filenames that match message/enum names.  E.g. "PerformerCaps" enum exists, so can't have "performer_caps.proto".  It produces non-compilable Java.
8. For simplicity we keep a one-to-one mapping between the GRPC package and the generated packages.  E.g.:
   ```
   package protocol.sdk.kv;
   option csharp_namespace = "Couchbase.Grpc.Protocol.Sdk.Kv";
   option java_package = "com.couchbase.client.performer.protocol.sdk.kv";
   ```
9. With Serverless it's becoming increasingly common to need similar interfaces at the Cluster, Bucket Scope and/or Collection level.
   To help, the new package naming scheme is `sdk.[cluster/scope/collection]...`
   More broadly, the idea now is that the right-most part of the package identifies broadly what it is, with each preceding
   part of the package revealing more and more specificity.
   Taking example `sdk.cluster.query.index_manager`: the right-most part identifies the broad strokes, e.g. that this is
   an IndexManager.  What type of IndexManager is it?  A QueryIndexManager.  What level is it at?  Cluster.
   We're following the precedent set in the SDK here, e.g. CollectionQueryIndexManager.
   Where there is a Cluster and Scope/Collection version of the same interface, they will often share some messages.
   The convention here is EITHER create 3 files with packages "sdk.cluster.search.index_manager", "sdk.scope.search.index_manager"
   and "sdk.search.index_manager" (for the shared messages).  
   OR just one package "sdk.search".  
   The approach selected should depend on how complex the interface is (e.g. does it have multiple methods), how much 
   it differs from Cluster/Bucket vs Scope/Collection forms, and whether that could change in future.

## Columnar
// todo tidyup
1.  Continues to apply.
2.  Probably tweaking.
3.  Continues to apply.  "protocol.shared" package now used for everything that applies to both SDKs.
4.  Probably tweaking.
5.  Continues to apply.
6.  Continues to apply, but we are using much shorter package names following feedback.
7.  Continues to apply.
8.  Probably Continues to apply.
10. Follow standard industry conventions:
    - Protobuf best practices
      - https://protobuf.dev/programming-guides/api
      - https://protobuf.dev/programming-guides/dos-donts/
    - (Note Google's GRPC errors (https://cloud.google.com/apis/design/errors) AREN'T followed, as we need more
      flexibility to express exactly what the SDK returned)


## Import package cycles
A Go-specific issue exists that impacted the design:

```
a.proto:
package protocol;
import "c.proto";

b.proto:
package protocol;

c.proto:
package protocol.sdk;
import "b.proto";
```

Go cannot compile this setup as c.proto is importing from the top-level package again, and Go sees this as an import cycle.

## Java Specifics
This will produce one Java class for each enum & message, in the com.couchbase.grpc.protocol package.  Default
behaviour is to wrap those classes in a class named after this .proto file, which makes refactoring hard.
```
option java_multiple_files = true;
```
