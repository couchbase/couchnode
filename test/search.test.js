'use strict';

var assert = require('assert');
var uuid = require('uuid');
var harness = require('./harness.js');
var testdata = require('./testdata');

var H = harness;
var Sq = H.lib.SearchQuery;

describe('#search', function() {
  describe('#Search Queries', function() {
    it('should generate sort correctly', function() {
      var q = H.lib.SearchQuery.new('index', null);
      q.sort([
        H.lib.SearchSort.score().descending(true),
        H.lib.SearchSort.id().descending(true),
        H.lib.SearchSort.field('f1')
          .type('a')
          .mode('b')
          .missing('c')
          .descending(true),
        H.lib.SearchSort.geoDistance('f2', 2, 3)
          .unit('km')
          .descending(true),
      ]);
      var qd = JSON.parse(JSON.stringify(q));
      assert(qd.sort[0].by === 'score');
      assert(qd.sort[0].desc === true);

      assert(qd.sort[1].by === 'id');
      assert(qd.sort[1].desc === true);

      assert(qd.sort[2].by === 'field');
      assert(qd.sort[2].field === 'f1');
      assert(qd.sort[2].type === 'a');
      assert(qd.sort[2].mode === 'b');
      assert(qd.sort[2].missing === 'c');
      assert(qd.sort[2].desc === true);

      assert(qd.sort[3].by === 'geo_distance');
      assert(qd.sort[3].field === 'f2');
      assert(qd.sort[3].location[0] === 3);
      assert(qd.sort[3].location[1] === 2);
      assert(qd.sort[3].unit === 'km');
      assert(qd.sort[3].desc === true);
    });
  });

  describe('#Search Queries (slow)', function() {
    H.requireFeature(H.Features.Fts, function() {
      var testUid = uuid.v4();
      var testIdxName = 'testidx-' + uuid.v4();

      it('should set up some test data successfully', function(done) {
        testdata.upsertData(H.b, testUid, done);
      });

      it('should successfully create an index to test with', function(done) {
        this.timeout(10000);

        var searchIdxMgr = H.c.manager().searchIndexManager();
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
          done
        );
      });

      it('should see test data correctly', function(done) {
        this.timeout(10000);

        function checkForTestData() {
          var q = Sq.new(testIdxName, {
            match: testUid,
            field: 'testUid',
            fuzziness: 0,
          });
          H.c.query(q, function(err, rows) {
            if (err || rows.length !== testdata.docCount()) {
              // If the data isn't there yet, schedule a wait and try again
              setTimeout(checkForTestData, 100);
              return;
            }

            done();
          });
        }
        checkForTestData();
      });

      it('should destroy the test index', function(done) {
        var searchIdxMgr = H.c.manager().searchIndexManager();
        searchIdxMgr.deleteIndex(testIdxName, done);
      });
    });
  });
});
