class PromiseHelper
{
    static async wrap(fn, callback) {
        // We wrap it in an additional promise to ensure that Node.js's
        // uncaught promise error handling is triggered normally.
        return new Promise((resolve, reject) => {
            fn().catch((err) => {
                if (callback) {
                    callback(err);
                }

                reject(err);
            }).then((res) => {
                if (callback) {
                    callback(null, res);
                }

                resolve(res);
            })
        });
        return ;
    }

    static async wrapRowEmitter(emitter, callback) {
        return new Promise((resolve, reject) => {
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

                    if (callback) {
                        callback(errOut, null);
                    }

                    return;
                }

                var res = {
                    meta: metaOut,
                    rows: rowsOut
                };

                resolve(res);

                if (callback) {
                    callback(errOut, res);
                }
            });
        });
    }
}
module.exports = PromiseHelper;