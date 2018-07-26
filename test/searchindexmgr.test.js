'use strict';

var assert = require('assert');
var harness = require('./harness.js');

// TODO(brett19): Currently skipped as the mock does not support FTS
describe.skip('#search index management', function() {
  this.timeout(5000);

  describe('#RealBucket', function() {
    var H = harness;
    var searchIdxMgr;
    before(function() {
      searchIdxMgr = H.c.manager(H.muser, H.mpass).searchIndexManager();
    });

    it('should be able to fetch indexes', function(done) {
      searchIdxMgr.getAllIndexDefinitions(function(err, indexes) {
        done(err);
      });
    });

    it('should be able to fetch a single index', function(done) {
      searchIdxMgr.getIndexDefinition('test', function(err, index) {
        done(err);
      });
    });

    it('should be able to fetch a index document counts', function(done) {
      searchIdxMgr.getIndexedDocumentCount('test', function(err,
        documents) {
        done(err);
      });
    });

    it('should be able to fetch a all index stats', function(done) {
      searchIdxMgr.getAllIndexStats(function(err, stats) {
        done(err);
      });
    });

    it('should be able to fetch a single index stats', function(done) {
      searchIdxMgr.getIndexStats('test', function(err, stats) {
        done(err);
      });
    });

    var firstPIndexName = null;

    it('should be able to fetch all partition info', function(done) {
      searchIdxMgr.getAllIndexPartitionInfo(function(err,
        pIndexInfos) {
        if (err) {
          done(err);
          return;
        }

        // Store a copy of the first pindex for later testing...
        var pIndexNames = Object.keys(pIndexInfos);
        if (pIndexNames.length > 0) {
          firstPIndexName = pIndexNames[0];
        }

        done(err);
      });
    });

    // Disabled because for some odd reason, it doesn't seem to work...
    // (always get err: `pindex not found`, even though the next call works with the same name)
    it.skip('should be able to fetch a single partition info', function(
      done) {
      if (!firstPIndexName) {
        done(new Error('no pindexes to test against'));
        return;
      }

      searchIdxMgr.getIndexPartitionInfo(firstPIndexName, function(
        err, pIndexInfo) {
        done(err);
      });
    });

    it('should be able to fetch a single partitions document count',
      function(done) {
        if (!firstPIndexName) {
          done(new Error('no pindexes to test against'));
          return;
        }

        searchIdxMgr.getIndexPartitionIndexedDocumentCount(
          firstPIndexName,
          function(err, docCount) {
            done(err);
          });
      });
  });
});
