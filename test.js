'use strict';

var couchbase = require('./lib/couchbase');

var cluster = new couchbase.Cluster('http://192.168.7.26:8091/');
var bucket = cluster.openBucket();

console.log(bucket._cb.lcbVersion());

/*
bucket._cb.setTranscoders(function(a, b, c){
  console.log('ENCODE', a, b, c);
  return JSON.stringify(a);
}, function(a, b, c) {
  console.log('DECODE', a, b, c);
  return JSON.parse(a.value);
});
*/

/*


var ne = new Error();
var ce = new CouchbaseError();

console.log(ne instanceof Error);
console.log(ne instanceof CouchbaseError);
console.log(ce instanceof Error);
console.log(ce instanceof CouchbaseError);
*/

var binding = require('./lib/binding');
var CouchbaseError = binding.Error;

var ne = new Error();
var ce = new CouchbaseError();
var te = bucket._cb._errorTest();

console.log(ne instanceof Error);
console.log(ne instanceof CouchbaseError);
console.log(ce instanceof Error);
console.log(ce instanceof CouchbaseError);
console.log(te instanceof Error);
console.log(te instanceof CouchbaseError);

/*
bucket.on('connect', function() {
  var bm = bucket.manager();
  bm.insertDesignDocument('test', {
    views: {
      simple: {
        map: 'function(doc, meta){emit(meta.id);}'
      }
    },
    spatial: {
      'simpleGeo': 'function(doc, meta){emit({type:"Point",coordinates:doc.loc},[meta.id, doc.loc]);}'
    }
  }, function(err, res) {
    console.log(err, res);
  });
});
*/

/*
bucket.on('connect', function() {
  var mgr = bucket.manager();
  mgr.upsertDesignDocument('TEST-17', ddoc, function(err, res) {
    console.log(err, res);
    mgr.getDesignDocument('TEST-17', function(err, res) {
      console.log(err, res);

      process.exit();
    });
  });
});
*/

/*
var cm = cluster.manager('Administrator', 'C0uchbase');
cm.createBucket('testss', {}, function(err, res) {
  console.log(err, res);
  setTimeout(function() {
    cm.removeBucket('testss', function(err, res) {
      console.log(err, res);
    });
  }, 1000);
});
*/
/*
bucket.getReplica('test', {index:0}, function(err, res) {
  console.log(err, res);
  process.exit();
});
*/
/*
cm.listBuckets(function(err, res) {
  console.log(err, res);
});
*/
/*
bucket.upsert('loltest', 'somevalue', {persist_to:1}, function(err, res) {
  console.log('done set', err, res);

  bucket.get('loltest', function(err, res) {
    console.log('done get', err, res);

    bucket.shutdown();
  });
});
*/

/*
bucket.on('connect', function() {
  var v = bucket._view('TEST-1676-querytest4', 'simple', {limit:8}, function(err, res) {
    console.log('view cb', err, res);
  });
  v.on('row', function(row) {
    console.log('view row', row);
  });
  v.on('rows', function(rows, meta) {
    console.log('view rows', rows, meta);
  });
  v.on('error', function(err) {
    console.log('view error', err);
  });
  v.on('end', function(totalRows) {
    console.log('view end', totalRows);
  })
});
*/
