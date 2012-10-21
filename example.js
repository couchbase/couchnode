var couchbase = require(__dirname),
    http = require("http");

couchbase.connect({
        "username" : "Administrator",
        "password":"animal",
        "hostname" : "localhost:8091",
        "bucket":"default"
    }, function(err, bucket) {
        if (err) {throw(err)}

        http.createServer(function(req, resp) {
            bucket.get("hitcount", function(err, doc, meta) {
                if (!doc) {
                    doc = {count:0};
                }
                doc.count++;
                resp.writeHead(200);
                bucket.set("hitcount", doc, meta, function(err) {
                    resp.end('<p>The server has seen '+doc.count+' hits</p>');
                })
            })
        }).listen(8080);
})
