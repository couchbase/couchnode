'use strict';

var uuid = require('uuid');
var harness = require('./harness.js');

describe('#search index management', function() {
  this.timeout(5000);

  var testIdxName = 'testidx-' + uuid.v4();
  var H = harness;
  var searchIdxMgr;

  before(function() {
    searchIdxMgr = H.c.manager().searchIndexManager();
  });

  H.requireFeature(H.Features.Fts, function() {
    it('should be able to fetch indexes', function(done) {
      searchIdxMgr.getAllIndexDefinitions(function(err) {
        done(err);
      });
    });

    it('should be able to create an index', function(done) {
      searchIdxMgr.createIndex(
        {
          name: testIdxName,
          type: 'fulltext-index',
          sourceType: 'couchbase',
          sourceName: H.b.name,
          params: {
            default_mapping: {
              enabled: true,
              dynamic: true,
              default_analyzer: '',
            },
            type_field: '_type',
            default_type: '_default',
            default_analyzer: 'standard',
            default_datetime_parser: 'dateTimeOptional',
            default_field: '_all',
            byte_array_converter: 'json',
            analysis: {},
          },
        },
        function(err) {
          done(err);
        }
      );
    });

    it('should be able to fetch a single index', function(done) {
      searchIdxMgr.getIndexDefinition(testIdxName, function(err) {
        done(err);
      });
    });

    it('should be able to fetch a all index stats', function(done) {
      searchIdxMgr.getAllIndexStats(function(err) {
        done(err);
      });
    });

    it('should be able to fetch a single index stats', function(done) {
      searchIdxMgr.getIndexStats(testIdxName, function(err) {
        done(err);
      });
    });

    it('should eventually finish preparing the test index', function(done) {
      this.timeout(10000);

      function checkOnce() {
        searchIdxMgr.getIndexStats(testIdxName, function(err, stats) {
          if (err || Object.keys(stats.pindexes).length <= 0) {
            setTimeout(checkOnce, 250);
            return;
          }

          done();
        });
      }
      checkOnce();
    });

    it('should be able to fetch a index document counts', function(done) {
      searchIdxMgr.getIndexedDocumentCount(testIdxName, function(err) {
        done(err);
      });
    });

    var firstPIndexName = null;

    it('should be able to fetch all partition info', function(done) {
      searchIdxMgr.getAllIndexPartitionInfo(function(err, pIndexInfos) {
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

    it('should be able to fetch a single partition info', function(done) {
      if (!firstPIndexName) {
        done(new Error('no pindexes to test against'));
        return;
      }

      searchIdxMgr.getIndexPartitionInfo(firstPIndexName, function(err) {
        done(err);
      });
    });

    it('should be able to fetch a single partitions document count', function(done) {
      if (!firstPIndexName) {
        done(new Error('no pindexes to test against'));
        return;
      }

      searchIdxMgr.getIndexPartitionIndexedDocumentCount(
        firstPIndexName,
        function(err) {
          done(err);
        }
      );
    });

    it('should be able to delete the test index', function(done) {
      searchIdxMgr.deleteIndex(testIdxName, done);
    });
  });
});
