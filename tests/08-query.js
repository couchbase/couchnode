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

  // Test `startkey`, `endkey` and `inclusive_end`
  function TestRange(callback) {
    var q = cb.view(docname, "simple", {
      startkey : 1,
      endkey : 5,
      stale: false,
      inclusive_end: false,
    });
    q.query(function(err, results) {
      var sum = u.reduce(
        u.pluck(results, 'key'),
        function(acc, n){ return acc + n; }, 0
      );
      assert(!err, "TestRange query failed")
      assert(sum===10, "TestRange without inclusive_end does not add up");

      // Along with it use `limit` parameter
      q.query({limit: 3}, function(err, results) {
        assert(!err, "TestRange query with limit failed")
        assert(results[0].key === 1, "TestRange first key is not 1");
        assert(results.length === 3, "TestRange lenght is not 3");

        // Along with it use `skip` parameter
        q.query({skip: 2}, function(err, results) {
          assert(!err, "TestRange query with skip failed")
          assert(results[0].key === 3, "TestRange first key is not 3");
          assert(results.length === 2, "TestRange lenght is not 2");
          callback(null, 3);
        });
      });
    })
  }

  // Range query in descending order.
  function TestRangeD(callback) {
    var q = cb.view(docname, "simple", {
            endkey : 3,
            startkey : 10,
            stale: false,
            descending : true,
            limit : 10
    });
    q.query(function(err, results) {
      assert(!err, "TestRangeD query failed")
      assert(results[0].key > results[1].key, "TestRangeD not descending")
      var sum = u.reduce(
        u.pluck(results, 'key'),
        function(acc, n){ return acc + n; }, 0
      );
      assert(sum===52, "TestRange without inclusive_end does not add up");

      // Apply `limit`
      q.query({limit: 3}, function(err, results) {
        assert(!err, "TestRange query with limit failed")
        assert(results[0].key === 10, "TestRange first key is not 10");
        assert(results.length === 3, "TestRange lenght is not 3");

        // Apply `skip`
        q.query({skip: 2}, function(err, results) {
          assert(!err, "TestRange query with skip failed")
          assert(results[0].key === 8, "TestRange first key is not 8");
          assert(results.length === 6, "TestRange lenght is not 6");
          callback(null, 6);
        });
      });
    })
  }

  // Test key and keys
  function TestKeys(callback) {
    var q = cb.view(docname, "simple", {
      key : 1,
      stale: false,
    });
    var cq = cb.view(docname, "simple", {
      keys : [1, 10],
      stale: false,
    });
    q.query(function(err, results) {
      assert(!err, "TestKeys query failed")
      assert(results.length === 1, "TestKeys expected only one result")

      // Fetch key within a range.
      var q1 = q.clone({startkey:1, endkey:5, key:1});
      q1.query(function(err, results) {
        // console.log(results);

        // Fetch more than one keys.
        cq.query(function(err, results) {
          assert(!err, "TestKeys query failed")
          assert(results.length === 2,
                 "TestKeys expected only two result")
          assert(results[0].id === "query-1", "TestKeys query-1")
          assert(results[1].id === "query-10", "TestKeys query-1")

          callback(null, 4);
        });
      });
    });
  }

  // Include full document while querying for them.
  function TestIncludeDocs(callback) {
    var q = cb.view(docname, "simple", {
      startkey : 1,
      endkey : 5,
      stale: false,
      include_docs : true,
      inclusive_end: false,
    });
    q.query(function(err, results) {
      assert(!err, "TestIncludeDocs query failed")
      assert(
          results[0].doc.meta.id === 'query-1',
          "TestIncludeDocs meta.id mismatch" )
      assert(
          results[0].doc.json.name === 'beta',
          "TestIncludeDocs meta.id mismatch" )
      callback(null, 5)
    });
  }

  // Test compound keys.
  function TestCompound(callback) {
    var q1 = cb.view( docname, "compound", {
      startkey : ["beta"],
      endkey : ["epsilon"],
      stale: false,
      reduce : false,
      limit : 10000
    })
    var q2 = q1.clone({
      startkey : ["epsilon"],
      endkey : ["beta"],
      stale: false,
      reduce : false,
      descending : true,
      limit : 10000
    })
    q1.query( function(err, results) {
      assert(!err, "TestCompound query failed")
      assert( results.length === 2000,
              "Failed TestCompound without reduce" )

      // With decending
      q2.query( function(err, results) {
        assert(!err, "TestCompound query with descending failed")
        assert(
            results.length === 2000,
            "Failed TestCompound descending without reduce" )
        assert(
            results[0].key > results[1].key, 
            "Failed TestCompound descending without reduce" )
        callback(null, 7)
      })
    })
  }

  function TestGroup(callback) {
    var results1 = null;
    var q = cb.view( docname, "compound", {
      startkey: ["beta"],
      endkey: ["pi"],
      stale: false,
    });
    var q1 = q.clone({ group: true, skip: 10, limit: 10 });
    var q2 = q.clone({ group_level: 2, skip: 10, limit: 10 });
    var q3 = q.clone({ group_level: 1, endkey: ["beta"], startkey: ["pi"],
                       descending: true, inclusive_end: true});

    // Plain reduce
    q.query(function(err, results) {
      assert(!err, "TestGroup failed ")
      assert(results[0].value === 6000, "TestGroup reduce query failed ")

      // with group = true, `skip` and `limit` parameters.
      q1.query(function(err, results) {
        var results1 = results;
        assert(!err, "TestGroup failed ");

        // With group_level = 2 and `skip` and `limit` parameters.
        q2.query(function(err, results) {
          assert(!err, "TestGroup failed ")
          assert(
              results.length === results1.length,
              "TestGroup level 2 failed")

          // With decending.
          q3.query(function(err, results) {
            assert(!err, "TestGroup failed ")
            assert(results.length===3, "TestGroup level 1 failed")
            assert(
                results[0].key[0] === 'kappa',
                "TestGroup level 1 failed"
            )
            assert(
                results[2].key[0] === 'beta',
                "TestGroup level 1 failed"
            )
            callback(null, 8)
          });
        });
      });
    });
  }

  function Shutdown(callback) {
    cb.shutdown();
    harness.end(0);
    callback(null, 5);
  }

  async.series([
          TestPopulate,
          TestDD,
          TestRange,
          TestRangeD,
          TestKeys,
          TestIncludeDocs,
          TestCompound,
          TestGroup,
          Shutdown
  ])
}()

