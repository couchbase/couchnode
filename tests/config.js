exports.create_cluster_handle = function() {
    var fs = require("fs")
    var cfgfile = "./config.json";
    if (!fs.existsSync(cfgfile)) {
	process.exit(64);
    }
    var config = JSON.parse(fs.readFileSync(cfgfile, "utf-8"));
    var couchnode = require('couchbase');
    var cb = new couchnode.Couchbase(config.hostname,
				     config.username,
				     config.password,
				     config.bucket);
    return cb;
};
