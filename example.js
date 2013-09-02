var couchbase = require("./lib/couchbase.js"),
    http = require("http"),
    fs = require("fs"),
    util = require("util");

var port = 8080;

var configFilename = 'config.json';
if (fs.existsSync(configFilename)) {
  config = JSON.parse(fs.readFileSync(configFilename));
} else {
  console.log(configFilename + " not found. Using default");
  config = { };
}

bucket = new couchbase.Connection(config, function(err) {
  if (err) {
    // For some reason we failed to make a connection to the
    // Couchbase cluster.
    throw err;
  }
});

http.createServer(function(req, resp) {
  bucket.get("hitcount", function(err, result) {
    var doc = result.value;
    if (!doc) {
      doc = {count:0};
    }

    doc.count++;

    resp.writeHead(200);
    console.log("hits", doc.count);

    bucket.set("hitcount", doc, {}, function(err) {
      if (err) {
          console.warn("Failed to store hit counter: " +
                       util.inspect(err));
          resp.end("<p>Internal server error. " +
                   "Failed to store:</p><pre>" + util.inspect(err) +
                   "</pre>");
      } else {
          resp.end('<p>The server has seen '+doc.count+' hits</p>');
      }
    });
  })
}).listen(port);
console.log("listening on http://localhost:" + port);
