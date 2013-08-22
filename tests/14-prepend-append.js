var harness = require('./harness.js');
var assert = require('assert');
var couchbase = require('../lib/couchbase.js');
harness.plan(7);

var t1 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("append");
  
  cb.remove(key, function(){});
  
  cb.append(key, 'willnotwork', function(err, meta){
    assert.equal(err.code, couchbase.errors.notStored);
    harness.end(0);
  });
}();

var t2 = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("prepend");
  cb.remove(key, function(){});
  cb.prepend(key, 'willnotwork', function(err, meta){
    assert.equal(err.code, couchbase.errors.notStored);
    harness.end(0);
  })
}();



function confirmKeyValue(H, key, expectedValue) {
  var cb = H.client;
    cb.get(key, H.docCallback(function(doc) {
      assert.equal(doc, expectedValue,
                   "Wrong value was returned. Expected:"
                   + expectedValue + " Received:" + doc);
      cb.remove(key, function (err, meta) {});
      harness.end(0);
  }));
}

function testIt(H, key, func, type, badMeta) {
    //Setup the key
  var cb = H.client;
  cb.set(key, "foo", H.okCallback(function(setMeta) {
    var meta = type == "withCas" ? setMeta : (type == 'wrongCas' ? badMeta : {});
    
    //cb.append or cb.prepend
    cb[func](key, "bar", meta, function (err, modMeta) {
      if (type == "wrongCas") {
        assert(err, "Cannot " + func + " with wrong cas");
        assert.equal(err.code, couchbase.errors.keyAlreadyExists);
        confirmKeyValue(H, key, "foo");

      } else {
        assert(!err, "Failed to "+func);
        confirmKeyValue(H, key, func == "prepend" ? "barfoo" : "foobar");
      }
    })
  }));
}


function testWithWrongCas(H, key,func, type) {
  var cb = H.client;
  
  cb.set(key, 'wrongCas', function (err, setMeta) {
    assert(!err, "Failed to store object");
    testIt(H, key, func, type, setMeta);
  });
  cb.remove(key, function (err, meta) {});
}

function testAll(H, testFunctions, testTypes ) {
  for (var i = 0, functionsCount = testFunctions.length; i < functionsCount; i++) {
    var func = testFunctions[i];
    for (var j = 0, typesCount = testTypes.length; j < typesCount; j++ ) {
      var type = testTypes[j];
      if (type == "wrongCas") testWithWrongCas(H, func+type, func, type);
      else testIt(H, func+type, func, type);
    }
  }
}

var t3 = function() {
  var H = new harness.Harness();
  //Now do the rest of the tests
  var functions = ["prepend", "append"];
  var types = ["withoutCas", "withCas", "wrongCas"];
  testAll(H, functions,types);
}();