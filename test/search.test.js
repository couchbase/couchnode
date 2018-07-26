'use strict';

var assert = require('assert');
var harness = require('./harness.js');

var H = harness;

describe('#search', function() {
  it('should generate sort correctly', function() {
    var q = H.lib.SearchQuery.new('index', null);
    q.sort([
      H.lib.SearchSort.score().descending(true),
      H.lib.SearchSort.id().descending(true),
      H.lib.SearchSort.field('f1')
      .type('a').mode('b').missing('c').descending(true),
      H.lib.SearchSort.geoDistance('f2', 2, 3)
      .unit('km').descending(true)
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
