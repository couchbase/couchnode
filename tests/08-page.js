var util = require("util");
var assert = require("assert");
var async = require("async");
var u = require("underscore");
var harness = require('./harness.js');

var H = new harness.Harness();
var cb = H.client;

harness.plan(1);

var t1 = function() {
  var docname = "querytest";
  var ddoc1 = {
    "views": {
      "simple": {
        "map": "function(doc,meta){doc.type==10 ? emit( Number( meta.id.slice(6, meta.id.length))) : null }"
      },
      "compound": {
        "map": "function(doc,meta){doc.type==10 ? emit([doc.name, Number(meta.id.slice(6, meta.id.length))]) : null}",
        "reduce" : "_count"
      }
    }
  };

  // Popolate sample set of documents. documents are of the format
  //  id : { "name" : <"alpha" | "beta" | "kappa" | "pi" | "epsilon"> }
  function TestPopulate(callback) {
    var values = ["alpha", "beta", "kappa", "pi", "epsilon"]
    var valueof = function(i) { 
      return "{ \"type\": 10, \"name\": \""+values[i%values.length]+ "\" }"
    }
    var multikv = {} 
    for (var i=0; i< 10000; i++) {
      multikv["query-"+i.toString()] = { value: valueof(i) };
    }
    cb.setMulti(multikv, {spooled:true}, function(){ 
      callback(null, 1);
    });
  }

  // Populate design-document with two views by name "simple" and "compound"
  function TestDD(callback) {
      cb.setDesignDoc(docname, ddoc1, function() {
        callback(null, 2)
      })
  }

  function TestPaginate(callback) {
      var pages = [];
      var q = cb.view(docname, "simple", {
        limit: 140,
        stale: false
      });
      q.firstPage(function(err, results, p) {
        assert(!err, "TestPaginate firstpage() failed")
        nextpages(results, p);
      });

      function nextpages(results, p) {
        pages.push( results );
        if (p.hasNext()) {
          p.next( function(err, results) {
            assert(!err, "TestPaginate next() failed")
            nextpages(results, p)
          });
        } else {
          assert( pages.length === 72, "TestPaginate failed" );
          var last = pages.pop();
          assert( last.length === 60, "TestPaginate failed" );

          p.prev( function(err, results) {
            assert(!err, "TestPaginate prev() failed");
            prevpages(results, p);
          });
        }
      };

      function prevpages(results, p) {
        var page = pages.pop();
        if (results.length > 0 ) {
          assert( u.isEqual(results, page) );
          p.prev( function(err, results) {
              assert(!err, "TestPaginate prev() failed")
              prevpages(results, p)
          });
        } else {
          p.next( function(err, results) {
            assert(!err, "TestPaginate next() failed")
            assert(results.length===140, "TestPaginate 1 next() failed")
            var l = results.pop();
            assert(l.id==="query-279", "TestPaginate 1 next() failed")
            callback(null, 4);
          });
        }
      };
  };

  function Shutdown(callback) {
    cb.shutdown();
    harness.end(0);
    callback(null, 5);
  }

  async.series([
     TestPopulate,
     TestDD,
     TestPaginate,
     Shutdown
  ])
}()


