'use strict';

function BucketManager(bucket) {
  this._bucket = bucket;
}

BucketManager.prototype.getDesignDocuments = function(callback) {
  var self = this;
  process.nextTick(function() {
    callback(null, self._bucket.ddocs);
  });
};

BucketManager.prototype.insertDesignDocument = function(name, data, callback) {
  var self = this;
  this.getDesignDocument(name, function(err, res) {
    if (!err) {
      return callback(new Error('design document already exists'), null);
    }
    self.upsertDesignDocument(name, data, callback);
  });
};

BucketManager.prototype.upsertDesignDocument = function(name, data, callback) {
  var self = this;
  process.nextTick(function() {
    var newViews = {};

    for (var viewType in data) {
      if (data.hasOwnProperty(viewType)) {
        if (viewType !== 'views') {
          // Silently ignore spatial views
          continue;
        }

        var newViewsT = {};
        newViews[viewType] = newViewsT;

        var mrList = data[viewType];
        for (var viewName in mrList) {
          if (mrList.hasOwnProperty(viewName)) {
            newViewsT[viewName] = {};
            if (!mrList[viewName].map) {
              callback(new Error('invalid view data'), null);
              return;
            }
            newViewsT[viewName].map = mrList[viewName].map.toString();
            if (mrList[viewName].reduce) {
              newViewsT[viewName].reduce = mrList[viewName].reduce.toString();
            }
          }
        }
      }
    }
    self._bucket.ddocs[name] = newViews;
    callback(null, true);
  });
};

BucketManager.prototype.getDesignDocument = function(name, callback) {
  var self = this;
  process.nextTick(function() {
    var ddoc = self._bucket.ddocs[name];
    if (!ddoc) {
      callback(new Error('not_found'), null);
      return;
    }
    var ddocs = {};
    ddocs[name] = ddoc;
    callback(null, ddocs);
  });
};

BucketManager.prototype.removeDesignDocument = function(name, callback) {
  var self = this;
  process.nextTick(function() {
    delete self._bucket.ddocs[name];
    callback(null, true);
  });
};

BucketManager.prototype.flush = function(callback) {
  var self = this;
  process.nextTick(function() {
    self._bucket.storage.items = {};
    callback(null, true);
  });
};

module.exports = BucketManager;
