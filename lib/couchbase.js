exports.Cluster = require('./cluster');
exports.Bucket = require('./bucket');
exports.Scope = require('./scope');
exports.Collection = require('./collection');
exports.DesignDocument = require('./designdocument');
exports.LookupInSpec = require('./lookupinspec');
exports.MutateInSpec = require('./mutateinspec');
exports.ReplicaMode = require('./enums').ReplicaMode;

// Move all the errors into the package scope
var errors = require('./errors');
for (var i in errors) {
  if (errors.hasOwnProperty(i)) {
    exports[i] = errors[i];
  }
}

/**
 * @typedef {function(Error, Cluster)} ConnectCallback
 */
/**
 * Creates a new Cluster object for interacting with a Couchbase
 * cluster and performing operations.
 *
 * @param {*} connStr
 * The connection string of your cluster
 * @param {*} [options]
 * @param {number} [options.username]
 * The RBAC username to use when connecting to the cluster.
 * @param {string} [options.password]
 * The RBAC password to use when connecting to the cluster
 * @param {string} [options.clientCertificate]
 * A client certificate to use for authentication with the server.  Specifying
 * this certificate along with any other authentication method (such as username
 * and password) is an error.
 * @param {string} [options.certificateChain]
 * A certificate chain to use for validating the clusters certificates.
 * @param {ConnectCallback} [callback]
 * @returns {Promise<Cluster>}
 */
exports.connect = async function connect() {
  return await exports.Cluster.connect.apply(null, arguments);
};
