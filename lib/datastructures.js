const PromiseHelper = require('./promisehelper');
const MutateInSpec = require('./mutateinspec');
const LookupInSpec = require('./lookupinspec');
const errors = require('./errors');

/**
 * CouchbaseList provides a simplified interface
 * for storing lists within a Couchbase document.
 */
class CouchbaseList {
  /**
   * @hideconstructor
   */
  constructor(collection, key) {
    this._coll = collection;
    this._key = key;
  }

  async _get() {
    var doc = await this._coll.get(this._key);
    if (!(doc.value instanceof Array)) {
      throw new errors.CouchbaseError('expected document of array type');
    }

    return doc.value;
  }

  async getAll(callback) {
    return PromiseHelper.wrapAsync(async () => {
      return await this._get();
    }, callback);
  }

  async forEach(rowCallback, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var values = await this._get();

      for (var i = 0; i < values.length; ++i) {
        rowCallback(values[i], i, this)
      }

      return true;
    }, callback);
  }

  [Symbol.asyncIterator]() {
    var _this = this;
    return {
      data: null,
      index: -1,
      async next() {
        if (this.index < 0) {
          this.data = await _this._get();
          this.index = 0;
        }

        if (this.index < this.data.length) {
          return { done: false, value: this.data[this.index++] };
        }

        return { done: true };
      }
    }
  }

  async getAt(index, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var res = await this._coll.lookupIn(this._key, [
        LookupInSpec.get('[' + index + ']')
      ]);

      var itemRes = res.results[0];
      if (itemRes.error) {
        throw itemRes.error;
      }

      return itemRes.value;
    }, callback);
  }

  async removeAt(index, callback) {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(this._key, [
        MutateInSpec.remove('[' + index + ']')
      ]);

      return true;
    }, callback);
  }

  async indexOf(value, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var items = await this._get();

      for (var i = 0; i < items.length; ++i) {
        if (items[i] === value) {
          return i;
        }
      }

      return -1;
    }, callback);
  }

  async size(callback) {
    return PromiseHelper.wrapAsync(async () => {
      var res = await this._coll.lookupIn(this._key, [
        LookupInSpec.count('')
      ]);

      return res.results[0].value;
    }, callback);
  }

  async push(value, callback) {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(this._key, [
        MutateInSpec.arrayAppend('', value)
      ], {
        upsertDocument: true
      });

      return true;
    }, callback);
  }

  async unshift(value, callback) {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(this._key, [
        MutateInSpec.arrayPrepend('', value)
      ], {
        upsertDocument: true
      });

      return true;
    }, callback);
  }
}
exports.List = CouchbaseList;

/**
 * CouchbaseMap provides a simplified interface
 * for storing a map within a Couchbase document.
 */
class CouchbaseMap {
  /**
   * @hideconstructor
   */
  constructor(collection, key) {
    this._coll = collection;
    this._key = key;
  }

  async _get() {
    var doc = await this._coll.get(this._key);
    if (!(doc.value instanceof Object)) {
      throw new errors.CouchbaseError('expected document of object type');
    }

    return doc.value;
  }

  async getAll(callback) {
    return PromiseHelper.wrapAsync(async () => {
      return await this._get();
    }, callback);
  }

  async forEach(rowCallback, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var values = await this._get();

      for (var i in values) {
        if (values.hasOwnProperty(i)) {
          rowCallback(values[i], i, this);
        }
      }

      return true;
    }, callback);
  }

  [Symbol.asyncIterator]() {
    var _this = this;
    return {
      data: null,
      keys: null,
      index: -1,
      async next() {
        if (this.index < 0) {
          this.data = await _this._get();
          this.keys = Object.keys(this.data);
          this.index = 0;
        }

        if (this.index < this.keys.length) {
          var key = this.keys[this.index++];
          return { done: false, value: [this.data[key], key] };
        }

        return { done: true };
      }
    }
  }

  async set(item, value, callback) {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(this._key, [
        MutateInSpec.upsert(item, value)
      ], {
        upsertDocument: true
      });

      return true;
    }, callback);
  }

  async get(item, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var res = await this._coll.lookupIn(this._key, [
        LookupInSpec.get(item)
      ]);

      var itemRes = res.results[0];
      if (itemRes.error) {
        throw itemRes.error;
      }

      return itemRes.value;
    }, callback);
  }

  async remove(item, callback) {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(this._key, [
        MutateInSpec.remove(item)
      ]);

      return true;
    }, callback);
  }

  async exists(item, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var res = await this._coll.lookupIn(this._key, [
        LookupInSpec.exists(item)
      ]);

      var itemRes = res.results[0];
      if (itemRes.error) {
        return false;
      }

      return true;
    }, callback);
  }

  async keys(callback) {
    return PromiseHelper.wrapAsync(async () => {
      var values = await this._get();
      return Object.keys(values);
    }, callback);
  }

  async values(callback) {
    return PromiseHelper.wrapAsync(async () => {
      var values = await this._get();
      return Object.values(values);
    }, callback);
  }

  async size(callback) {
    return PromiseHelper.wrapAsync(async () => {
      var res = await this._coll.lookupIn(this._key, [
        LookupInSpec.count('')
      ]);

      return res.results[0].value;
    }, callback);
  }
}
exports.Map = CouchbaseMap;

/**
 * CouchbaseQueue provides a simplified interface
 * for storing a queue within a Couchbase document.
 */
class CouchbaseQueue {
  /**
   * @hideconstructor
   */
  constructor(collection, key) {
    this._coll = collection;
    this._key = key;
  }

  async _get() {
    var doc = await this._coll.get(this._key);
    if (!(doc.value instanceof Array)) {
      throw new errors.CouchbaseError('expected document of array type');
    }

    return doc.value;
  }

  async size(callback) {
    return PromiseHelper.wrapAsync(async () => {
      var res = await this._coll.lookupIn(this._key, [
        LookupInSpec.count('')
      ]);

      return res.results[0].value;
    }, callback);
  }

  async push(value, callback) {
    return PromiseHelper.wrapAsync(async () => {
      await this._coll.mutateIn(this._key, [
        MutateInSpec.arrayPrepend('', value)
      ], {
        upsertDocument: true
      });

      return true;
    }, callback);
  }

  async pop(callback) {
    return PromiseHelper.wrapAsync(async () => {
      for (var i = 0; i < 16; ++i) {
        try {
          var res = await this._coll.lookupIn(this._key, [
            LookupInSpec.get('[-1]')
          ]);

          var value = res.results[0].value

          await this._coll.mutateIn(this._key, [
            MutateInSpec.remove('[-1]')
          ], {
            cas: res.cas
          });

          return value;
        } catch (e) {
          if (e.message.match('invalid index')) {
            throw new errors.CouchbaseError('no items available in list');
          }

          // continue and retry
        }
      }

      throw new errors.CouchbaseError('no items available to pop');
    }, callback);
  }
}
exports.Queue = CouchbaseQueue;

/**
 * CouchbaseSet provides a simplified interface
 * for storing a set within a Couchbase document.
 */
class CouchbaseSet {
  /**
   * @hideconstructor
   */
  constructor(collection, key) {
    this._coll = collection;
    this._key = key;
  }

  async _get() {
    var doc = await this._coll.get(this._key);
    if (!(doc.value instanceof Array)) {
      throw new errors.CouchbaseError('expected document of array type');
    }

    return doc.value;
  }

  async add(item, callback) {
    return PromiseHelper.wrapAsync(async () => {
      try {
        await this._coll.mutateIn(this._key, [
          MutateInSpec.arrayAddUnique('', item)
        ], {
          upsertDocument: true
        });
      } catch (e) {
        if (e.message.match('path already exists')) {
          return false;
        }

        throw e;
      }

      return true;
    }, callback);
  }

  async contains(item, callback) {
    return PromiseHelper.wrapAsync(async () => {
      var values = await this._get();
      for (var i = 0; i < values.length; ++i) {
        if (values[i] === item) {
          return true;
        }
      }
      return false;
    }, callback);
  }

  async remove(item, callback) {
    return PromiseHelper.wrapAsync(async () => {
      for (var i = 0; i < 16; ++i) {
        try {
          var res = await this._get();

          var itemIdx = res.indexOf(item);
          if (itemIdx === -1) {
            throw new Error('item was not found in set');
          }

          await this._coll.mutateIn(this._key, [
            MutateInSpec.remove('[' + itemIdx + ']')
          ], {
            cas: res.cas
          });

          return true;
        } catch (e) {
          // continue and retry
        }
      }

      throw new errors.CouchbaseError('no items available to pop');
    }, callback);
  }

  async values(callback) {
    return PromiseHelper.wrapAsync(async () => {
      return await this._get();
    }, callback);
  }

  async size(callback) {
    return PromiseHelper.wrapAsync(async () => {
      var res = await this._coll.lookupIn(this._key, [
        LookupInSpec.count('')
      ]);

      return res.results[0].value;
    }, callback);
  }
}
exports.Set = CouchbaseSet;
