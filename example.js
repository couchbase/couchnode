var couchbase = require("couchbase");
var http = require("http");
var fs = require("fs");
var util = require("util");

var port = 8080;

var configFilename = 'config.json';
if (fs.existsSync(configFilename)) {
    config = JSON.parse(fs.readFileSync(configFilename));
} else {
    console.log(configFilename + " not found. Using default");
    config = { };
}

couchbase.connect(config, function(err, bucket) {
    if (err) {
        // For some reason we failed to make a connection to the
        // Couchbase cluster.
        throw err;
    }

    http.createServer(function(req, resp) {
        bucket.get("hitcount", function(err, doc, meta) {
            // @todo check the error reason!
            if (!doc) {
                doc = {count:0};
            }

            doc.count++;
            resp.writeHead(200);
            console.log("hits", doc.count);
            bucket.set("hitcount", doc, meta, function(err) {
                if (err) {
                    console.warn("Failed to store hit counter: " +
                                 util.inspect(err));
                    resp.end("<p>Internal server error. " +
                             "Failed to store:</p><pre>" + util.inspect(err) +
                             "</pre>");
                } else {
                    resp.end('<p>The server has seen '+doc.count+' hits</p>');
                }
            })
        })
    }).listen(port);
    console.log("listening on http://localhost:" + port);
})
