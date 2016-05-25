'use strict';

/**
 * Implements mutation token aggregation for performing consistentWith
 * N1qlQuery's.  Accepts any number of arguments (one per document/tokens).
 *
 * @constructor
 * 
 * @since 2.1.7
 * @uncommitted
 */
function MutationState() {
  this._data = {};
  for (var i = 0; i < arguments.length; ++i) {
    this._addSingle(arguments[i]);
  }
}

MutationState.prototype._addSingle = function(token) {
  if (!token) {
    return;
  }
  if (token.token) {
    token = token.token;
  }
  var tokenData = token.toString().split(':');
  if (tokenData.length < 4 || tokenData[3] === '') {
    return;
  }
  var vbId = tokenData[0];
  var vbUuid = tokenData[1];
  var vbSeqNo = parseInt(tokenData[2], 10);
  var bucketName = tokenData[3];

  if (!this._data[bucketName]) {
    this._data[bucketName] = {};
  }
  if (!this._data[bucketName][vbId]) {
    this._data[bucketName][vbId] = [vbSeqNo, vbUuid];
  } else {
    var info = this._data[bucketName][vbId];
    if (info[0] < vbSeqNo) {
      info[0] = vbSeqNo;
    }
  }
};

/**
 * Adds an additional token to this MutationState
 * Accepts any number of arguments (one per document/tokens).
 *
 * @since 2.1.7
 * @uncommitted
 */
MutationState.prototype.add = function() {
  for (var i = 0; i < arguments.length; ++i) {
    this._addSingle(arguments[i]);
  }
};

MutationState.prototype.toJSON = function() {
  return this._data;
};

MutationState.prototype.inspect = function() {
  var tokens = '';
  for (var bucket in this._data) {
    if (this._data.hasOwnProperty(bucket)) {
      for (var vbid in this._data[bucket]) {
        if (this._data[bucket].hasOwnProperty(vbid)) {
          var info = this._data[bucket][vbid];
          if (tokens !== '') {
            tokens += ';';
          }
          tokens += vbid + ':' + info[0] + ':' +
              info[1] + ':' + bucket;
        }
      }
    }
  }
  return 'MutationState<' + tokens + '>';
};

module.exports = MutationState;
