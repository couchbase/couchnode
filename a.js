// This file should not be pushed to the repo, just added here in order
// to be able to test this thing..

// @todo figure out how to do this properly..
var cb = require('./couchbase.js');

// Create a new instance of the couchbase
var bucket = cb.create({
    hosts : [ "localhost:9000" ],
    bucket : "default",
    password : "",
    user : ""
});


console.log("THe couchbase object looks like:\n", bucket);

bucket.on("error", function() {
    console.log("An unrecoverable error occurred. Terminate the couchbase bucket connection and retry");
    process.exit(1);
});

bucket.on("connect", function() {
    // At this time you know you're connected and you may reset the
    // error handler to something else..
    console.log("yay.. connected");

    bucket.get("foo", function(error, doc, meta) {
	if (error) {
            console.log("Object not found", meta);
	} else {
            console.log("found object: ", meta, doc);
	}
    });

    bucket.get([ "foo", "bar" ], function(error, doc, meta) {
	if (error) {
            console.log("Object not found", meta);
	} else {
            console.log("found object: ", meta, doc);
	}
    });

    bucket.set("foo", "bar", function(error, meta) {
	if (error) {
            console.log("Store failed: ", meta);
	} else {
            console.log("Store success ", meta);
	    bucket.set("foo", "bar2", meta, function(error, meta) {
		if (error) {
		    console.log("cas oper failed");
                } else {
		    console.log("cas oper success");
		    bucket.delete("foo", function(error, id) {
			if (error) {
			    console.log("Failed to delete ", id);
			} else {
			    console.log("Deleted ", id);

			    bucket.get([ "foo", "bar" ], function(error, doc, meta) {
				if (error) {
				    console.log("Object not found", meta);
				} else {
				    console.log("found object: ", meta, doc);
				}
			    });
			}
		    });
		}
	    });
	}
    });
});
