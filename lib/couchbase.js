'use strict';

var binding = require('./binding');

module.exports.Cluster = require('./cluster');
module.exports.SpatialQuery = require('./spatialquery');
module.exports.ViewQuery = require('./viewquery');
module.exports.N1qlQuery = require('./n1qlquery');
module.exports.SearchQuery = require('./searchquery');
module.exports.SearchFacet = require('./searchquery_facets');
module.exports.MutationState = require('./mutationstate');
module.exports.Mock = require('./mock/couchbase');
module.exports.Error = binding.Error;
module.exports.errors = require('./errors');
