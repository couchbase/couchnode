'use strict';

var TEST_DOCS = [
  { x: 0, y: 0, name: 'x0,y0' },
  { x: 1, y: 0, name: 'x1,y0' },
  { x: 2, y: 0, name: 'x2,y0' },
  { x: 0, y: 1, name: 'x0,y1' },
  { x: 1, y: 1, name: 'x1,y1' },
  { x: 2, y: 1, name: 'x2,y1' },
  { x: 0, y: 2, name: 'x0,y2' },
  { x: 1, y: 2, name: 'x1,y2' },
  { x: 2, y: 2, name: 'x2,y2' },
];

function upsertTestData(bucket, testUid, done) {
  var remainingUpserts = TEST_DOCS.length;
  for (var i = 0; i < TEST_DOCS.length; ++i) {
    var testDocKey = testUid + '::' + i;
    var testDoc = TEST_DOCS[i];
    testDoc.testUid = testUid;

    bucket.upsert(testDocKey, testDoc, function(err) {
      if (err) {
        throw err;
      }

      if (--remainingUpserts === 0) {
        done();
      }
    });
  }
}

module.exports.upsertData = upsertTestData;

function testDocCount() {
  return TEST_DOCS.length;
}

module.exports.docCount = testDocCount;
