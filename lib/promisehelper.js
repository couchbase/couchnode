/**
 * @private
 */
class PromiseHelper {
  static async wrapAsync(fn, callback) {
    // We wrap it in an additional promise to ensure that Node.js's
    // uncaught promise error handling is triggered normally.
    return new Promise((resolve, reject) => {
      fn().then((res) => {
        if (callback) {
          callback(null, res);
        }

        resolve(res);
      }).catch((err) => {
        if (callback) {
          callback(err);
        }

        reject(err);
      });
    });
  }

  static async wrap(fn, callback) {
    return new Promise((resolve, reject) => {
      fn((err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }

        if (callback) {
          callback(err, res);
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
              rows: rowsOut
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
