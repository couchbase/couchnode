var config = require('./config')
var cb = config.create_cluster_handle();

cb.on("error",
      function (message) {
	  console.log("ERROR: [" + message + "]");
	  process.exit(1);
      }
     );

var testkey = "05-replace.js"

function verify_key(key)
{
    if (key != testkey) {
	console.log("Callback called with wrong key!");
	process.exit(1);
    }
}

function replace_existing_handler(data, error, key, cas) {
    verify_key(key);

    if (error) {
	console.log("I should be able to replace a key!");
	process.exit(1);
    } else {
	process.exit(0);
    }
}

function replace_missing_handler(data, error, key, cas) {
    verify_key(key);

    if (error) {
	cb.set(testkey, "bar", 0, undefined,
	       function (data, error, key, cas) {
		   verify_key(key);
		   if (error) {
		       console.log("Failed to store object");
		       process.exit(1);
		   }
		   cb.replace(testkey, "bar", 0, undefined,
			      replace_existing_handler);
	       });
    } else {
	console.log("I shouldn't be able to replace a nonexisting key!");
	process.exit(1);
    }
}

cb.delete(testkey, undefined, function(){});
cb.replace(testkey, "bar", 0, undefined, replace_missing_handler);

