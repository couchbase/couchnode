var setup = require('./setup'), assert = require('assert');

process.on('uncaughtException', function(err){
  // Cannot use assert here as it causes an assertion loop
  if (err.message!='expected-error') {
    throw err; 
  }
  setup.end();
});

setup(function(err, cb) {
	assert(!err, "setup failure");

	var testkey = "18-cb-error.js";
	cb.get(testkey, function(err, meta) {
		throw new Error('expected-error');
	});
});
