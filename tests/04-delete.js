var config = require('./config')
var cb = config.create_cluster_handle();

cb.on("error",
      function (message) {
	  console.log("ERROR: [" + message + "]");
	  process.exit(1);
      }
     );

var testkey = "04-delete.js"

function verify_key(key)
{
    if (key != testkey) {
	console.log("Callback called with wrong key!");
	process.exit(1);
    }
}

function delete_nonexisting_handler(data, error, key)
{
    verify_key(key);
    if (error) {
	process.exit(0);
    } else {
	console.error("Delete of a nonexisting item should fail");
	process.exit(1);
    }
}

function delete_existing_handler(data, error, key)
{
    verify_key(key);
    if (error) {
	console.log("Failed to delete object that should exist");
	process.exit(1);
    }
    cb.delete(testkey, undefined, delete_nonexisting_handler);
}


function set_handler(data, error, key, cas)
{
    verify_key(key);

    if (error) {
	console.log("Failed to store object");
	process.exit(1);
    } else {
	cb.delete(testkey, undefined, delete_existing_handler);
    }
}

cb.set(testkey, "bar", 0, undefined, set_handler);

