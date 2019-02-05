'use strict';

var assert = require('assert');
var uuid = require('uuid');
var harness = require('./harness');
var testdata = require('./testdata');

var H = harness;
var Aq = harness.lib.AnalyticsQuery;

function checkQueryOpts(q, params, res) {
  var qobj = q.toObject(params);
  assert.deepEqual(qobj, res);
}

describe('#analytics', function() {
  describe('#Analytics Queries', function() {
    it('should create queries correctly', function() {
      var q = Aq.fromString('SELECT * FROM default');
      checkQueryOpts(q, null, {
        statement: 'SELECT * FROM default',
      });
    });

    it('should set query pretty correctly', function() {
      var q1 = Aq.fromString('SELECT * FROM default')
        .pretty(true);
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        pretty: true
      });
    });

    it('should set query priority correctly', function() {
      var q1 = Aq.fromString('SELECT * FROM default')
        .priority(true);
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        priority: true
      });
    });

    it('should set query raw parameters correctly', function() {
      var q1 = Aq.fromString('SELECT * FROM default')
        .rawParam('test', ['this-is-a-test', 2]);
      checkQueryOpts(q1, null, {
        statement: 'SELECT * FROM default',
        test: ['this-is-a-test', 2]
      });
    });
  });

  describe('#Analytics Queries (slow)', function() {
    H.requireFeature(H.Features.Analytics, function() {
      var testUid = uuid.v4();
      var dsName = ('ds-' + testUid).replace(/-/g, '_');

      it('should set up some test data successfully',
        function(done) {
          testdata.upsertData(H.b, testUid, done);
        });

      it('should disconnect the dataverse', function(done) {
        this.timeout(5000);

        var q = Aq.fromString('DISCONNECT LINK Local');
        H.b.query(q, function() {
          done();
        });
      });

      it('should create a test dataset', function(done) {
        this.timeout(5000);

        var q = Aq.fromString(
          'CREATE DATASET ' + dsName +
          ' ON ' + H.b.name +
          ' WHERE testUid="' + testUid + '";'
        );
        H.b.query(q, done);
      });

      it('should connect the dataverse', function(done) {
        this.timeout(5000);

        var q = Aq.fromString('CONNECT LINK Local');
        H.b.query(q, function() {
          done();
        });
      });

      it('should see test data correctly', function(done) {
        this.timeout(60000);

        function checkForTestData() {
          var q = Aq.fromString('SELECT * FROM ' + dsName);
          H.b.query(q, function(err, rows) {
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

      it('should work with parameters', function(done) {
        var q = Aq.fromString(
          'SELECT * FROM ' + dsName +
          ' WHERE x=?');
        H.b.query(q, [1], H.okCallback(function(rows) {
          assert.equal(rows.length, 3);
          done();
        }));
      });

      it('should ingest successfully', function(done) {
        this.timeout(5000);

        var ingestUid = uuid.v4();

        var idGen = function(data) {
          return ingestUid + '-' + data.x + ':' + data.y;
        };
        var dataConv = function(data) {
          return {
            shortName: data.x + ':' + data.y
          };
        };
        var q = Aq.fromString(
          'SELECT x, y FROM ' + dsName);
        H.b.analyticsIngest(q, {
          dataConverter: dataConv,
          idGenerator: idGen
        }, H.okCallback(function(meta) {
          assert(!!meta);

          H.b.getMulti([
            ingestUid + '-0:0',
            ingestUid + '-0:1',
            ingestUid + '-0:2',
            ingestUid + '-1:0',
            ingestUid + '-1:1',
            ingestUid + '-1:2',
            ingestUid + '-2:0',
            ingestUid + '-2:1',
            ingestUid + '-2:2',
          ], H.okCallback(function(res) {
            assert.equal(Object.keys(res).length, 9);
            for (var key in res) {
              var value = res[key].value;
              assert(value.shortName.match(/.:./));
            }
            done();
          }));
        }));
      });

      it('should ingest with defaults succesfully', function(done) {
        this.timeout(5000);

        var ingestUid = uuid.v4();
        var q = Aq.fromString(
          'SELECT x, y, "' + ingestUid + '" AS testUid' +
          ' FROM ' + dsName);
        H.b.analyticsIngest(q, {}, done);

        // TODO(brett19): Should probably validate the inserted data
      });

      it('should disconnect the dataverse', function(done) {
        this.timeout(5000);

        var q = Aq.fromString('DISCONNECT LINK Local');
        H.b.query(q, done);
      });

      it('should clean up the test dataset', function(done) {
        this.timeout(5000);

        var q = Aq.fromString('DROP DATASET ' + dsName);
        H.b.query(q, done);
      });
    });
  });
});
