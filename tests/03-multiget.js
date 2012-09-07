var config = require('./config')
var cb = config.create_cluster_handle();

cb.on("error",
      function (message) {
	  console.log("ERROR: [" + message + "]");
	  process.exit(1);
      }
     );

var num_callbacks = 0;

function get_handler (data, error, key, cas, flags, value) {
    if (error) {
	console.log("Object should exist!");
	process.exit(1);
    }

    ++num_callbacks;
    if (num_callbacks = 10) {
	process.exit(0);
    }
}

function get_single_existing_item() {
    cb.get("key0", undefined,
	   function (data, error, key, cas, flags, value) {
	       if (error) {
		   console.log("Object should exist!");
		   process.exit(1);
	       }

	       num_callbacks = 0;
	       var keys = new Array();
	       keys[0] = "key0";
	       keys[1] = "key1";
	       keys[2] = "key2";
	       keys[3] = "key3";
	       keys[4] = "key4";
	       keys[5] = "key5";
	       keys[6] = "key6";
	       keys[7] = "key7";
	       keys[8] = "key8";
	       keys[9] = "key9";

	       cb.get(keys, 0, get_handler);
	   }
	  );
}

function set_handler(data, error, key, cas) {
    if (error) {
	console.log("Failed to store object");
	process.exit(1);
    }

    ++num_callbacks;
    if (num_callbacks = 10) {
	get_single_existing_item();
    }
}

cb.set("key0", "value", 0, undefined, set_handler);
cb.set("key1", "value", 0, undefined, set_handler);
cb.set("key2", "value", 0, undefined, set_handler);
cb.set("key3", "value", 0, undefined, set_handler);
cb.set("key4", "value", 0, undefined, set_handler);
cb.set("key5", "value", 0, undefined, set_handler);
cb.set("key6", "value", 0, undefined, set_handler);
cb.set("key7", "value", 0, undefined, set_handler);
cb.set("key8", "value", 0, undefined, set_handler);
cb.set("key9", "value", 0, undefined, set_handler);
