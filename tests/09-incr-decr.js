require('longjohn');
var harness = require('./harness.js');
var assert = require('assert');

harness.plan(4); // exit at 6th call to setup.end()

var incrDecrSimple = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("incrdecr1");

  cb.remove(key, function(err) {
    cb.incr(key, {initial: 0}, H.docCallback(function(doc){
      assert.equal(doc, 0, "Initial value should be 0");

      cb.incr(key, H.docCallback(function(doc){
        assert.equal(doc, 1, "Increment by one");

        cb.decr(key, H.docCallback(function(doc){
          assert.equal(doc, 0, "Decrement by 0");
          harness.end(0);
        }));
      }));
    }));
  });
}();

var incrDecrOffset = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("incrdecr2");

  cb.remove(key, function(){
    cb.incr(key, {initial: 0, offset: 100}, H.docCallback(function(doc){
      assert.equal(0, doc, "Offset ignored when doing default");
      cb.incr(key, {offset: 20}, H.docCallback(function(doc){
        assert.equal(doc, 20, "Increment by 20");
        cb.decr(key, {offset: 15}, H.docCallback(function(doc){
          assert.equal(doc, 5, "Decrement by 5");
          harness.end(0);
        }));
      }));
    }));
  });
}();

var incrDecrDefault = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("incrdecr3");

  cb.remove(key, function(){
    cb.incr(key, function(err, meta){
      assert(err, "Error when incrementing key that does not exist");
      cb.incr(key, {initial: 500, offset: 20}, H.docCallback(function(doc){
        assert.equal(doc, 500, "Offset is ignored when default is used");
        cb.decr(key, {initial: 999, offset: 10}, H.docCallback(function(doc){
          assert.equal(doc, 490, "Initial is ignored when value exists");
          harness.end(0);
        }))
      }))
    })
  })
}();

var incrDecrExpiry = function() {
  var H = new harness.Harness();
  var cb = H.client;
  var key = H.genKey("incrdecr4");

  cb.remove(key, function(){
    cb.incr(key, {offset:20, initial:0, expiry:1}, H.docCallback(function(blah){
      cb.incr(key, H.docCallback(function(doc){
        assert.equal(doc, 1);
        setTimeout(function(){
          cb.get(key, function(err, meta){
            assert(err, "Expiry with arithmetic");
            harness.end(0);
          })
        }, 2000);
      }));
    }))
  })
}();
