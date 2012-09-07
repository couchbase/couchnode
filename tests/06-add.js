var config = require('./config')
var cb = config.create_cluster_handle();

cb.on("error",
      function (message) {
	  console.log("ERROR: [" + message + "]");
	  process.exit(1);
      }
     );

var testkey = "06-add.js"

function verify_key(key)
{
    if (key != testkey) {
	console.log("Callback called with wrong key!");
	process.exit(1);
    }
}

function add_existing_handler(data, error, key, cas) {
    verify_key(key);

    if (error) {
	process.exit(0);
    } else {
	console.log("I shouldn't be able to add an existing key!");
	process.exit(1);
    }
}

function add_missing_handler(data, error, key, cas) {
    verify_key(key);

    if (error) {
	console.log("I should be able to add a nonexisting key!");
	process.exit(1);
    } else {
	cb.add(testkey, "bar", 0, undefined, add_existing_handler);
    }
}

cb.delete(testkey, undefined, function(){});
cb.add(testkey, "bar", 0, undefined, add_missing_handler);

