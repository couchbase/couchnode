'use strict';

var binding = require('./binding');
var auth = require('./auth');
var consts = require('./constants');

module.exports.Cluster = require('./cluster');
module.exports.BucketImpl = require('./bucket');
module.exports.SpatialQuery = require('./spatialquery');
module.exports.ViewQuery = require('./viewquery');
module.exports.N1qlQuery = require('./n1qlquery');
module.exports.CbasQuery = require('./cbasquery');
module.exports.SearchQuery = require('./searchquery');
module.exports.SearchFacet = require('./searchquery_facets');
module.exports.SearchSort = require('./searchquery_sort');
module.exports.MutationState = require('./mutationstate');
module.exports.Mock = require('./mock/couchbase');
module.exports.Error = binding.Error;
module.exports.errors = require('./errors');
module.exports.ServiceType = consts.ServiceType;
module.exports.ClassicAuthenticator = auth.ClassicAuthenticator;
module.exports.PasswordAuthenticator = auth.PasswordAuthenticator;
