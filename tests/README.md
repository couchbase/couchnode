The default cluster cofiguration for the tests is:

```
{
    "hosts" : [ "localhost:8091" ],
    "bucket" : "default"
}
```

If your cluster configuration is a bit different (e.g. you don't have a
couchbase server running on localhost, not using a default bucket, or
have a SASL password for your bucket), then you will need to create a
`config.json` file that looks something like:

```
{
   "hosts" : [ "localhost:8091" ],
   "username" : "Administrator",
   "password" : "password",
   "bucket" : "default"
}
```

Included is a `config.json.sample` which you may rename to `config.json`
