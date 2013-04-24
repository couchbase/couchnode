var setup = require('./setup'), assert = require('assert');
process.exit(64);
setup.plan(1); // exit at first call to setup.end()

setup(function(err, cb) {
	assert(!err, "setup failure");

	cb.on("error", function(message) {
		console.log("ERROR: [" + message + "]");
		process.exit(1);
	});
	var testkey = "18-cb-error.js";

	assert.throws(function() {
		cb.set(testkey, "bar", function(err, meta) {
			var err = new Error('Error should be caught somewhere');
			throw err;
		});
	});

	setup.end();
});
