'use strict';

/**
 * @private
 */
class PromiseHelper {
  static async wrapAsync(fn, callback) {
    // If a callback in in use, we wrap the promise with a handler which
    // forwards to the callback and return undefined.  If there is no
    // callback specified.  We directly return the promise.
    if (callback) {
      fn()
        .then((res) => callback(null, res))
        .catch((err) => callback(err));
      return undefined;
    }

    return fn();
  }

  static async wrap(fn, callback) {
    // If a callback is in use, we simply pass that directly to the
    // function, otherwise we wrap the async function in a promise.
    if (callback) {
      fn(callback);
      return undefined;
    }

    return new Promise((resolve, reject) => {
      fn((err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  }

  static async wrapRowEmitter(emitter, callback) {
    var promiseCache = null;
    const getPromise = () => {
      if (!promiseCache) {
        promiseCache = new Promise((resolve, reject) => {
          var rowsOut = [];
          emitter.on('row', (row) => {
            rowsOut.push(row);
          });

          var errOut = null;
          var metaOut = null;
          emitter.on('error', (err) => {
            errOut = err;
          });
          emitter.on('meta', (meta) => {
            delete meta.results;
            metaOut = meta;
          });
          emitter.on('end', () => {
            if (errOut) {
              reject(errOut);
              return;
            }

            resolve({
              meta: metaOut,
              rows: rowsOut,
            });
          });
        });
      }
      return promiseCache;
    };

    if (callback) {
      getPromise()
        .then((res) => callback(null, res))
        .catch((err) => callback(err, null));
    }

    emitter.then = (onFulfilled, onRejected) => {
      var promise = getPromise();
      return promise.then.call(promise, onFulfilled, onRejected);
    };
    emitter.catch = (onRejected) => {
      var promise = getPromise();
      return promise.catch.call(promise, onRejected);
    };
    emitter.finally = (onFinally) => {
      var promise = getPromise();
      return promise.finally.call(promise, onFinally);
    };

    return emitter;
  }

  static async wrapStreamEmitter(emitter, evtName, callback) {
    var promiseCache = null;
    const getPromise = () => {
      if (!promiseCache) {
        promiseCache = new Promise((resolve, reject) => {
          var dataOut = [];
          emitter.on(evtName, (data) => {
            dataOut.push(data);
          });

          var errOut = null;
          emitter.on('error', (err) => {
            errOut = err;
          });
          emitter.on('end', () => {
            if (errOut) {
              reject(errOut);
              return;
            }

            resolve(dataOut);
          });
        });
      }
      return promiseCache;
    };

    if (callback) {
      getPromise()
        .then((res) => callback(null, res))
        .catch((err) => callback(err, null));
    }

    emitter.then = (onFulfilled, onRejected) => {
      var promise = getPromise();
      return promise.then.call(promise, onFulfilled, onRejected);
    };
    emitter.catch = (onRejected) => {
      var promise = getPromise();
      return promise.catch.call(promise, onRejected);
    };
    emitter.finally = (onFinally) => {
      var promise = getPromise();
      return promise.finally.call(promise, onFinally);
    };

    return emitter;
  }
}
module.exports = PromiseHelper;
