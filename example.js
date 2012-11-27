var couchbase = require("couchbase"),
    http = require("http");

var port = 8080;

couchbase.connect(require(__dirname+'/tests/config.json'), function(err, bucket) {
    if (err) {throw(err)}

    http.createServer(function(req, resp) {
        bucket.get("hitcount", function(err, doc, meta) {
            if (!doc) {
                doc = {count:0};
            }
            doc.count++;
            resp.writeHead(200);
            console.log("hits", doc.count);
            bucket.set("hitcount", doc, meta, function(err) {
                resp.end('<p>The server has seen '+doc.count+' hits</p>');
            })
        })
    }).listen(port);
    console.log("listening on http://localhost:" + port);
})
