var config = require('./config')
var cb = config.create_cluster_handle();

cb.on("error",
      function (message) {
	  console.log("ERROR: [" + message + "]");
	  process.exit(1);
      }
     );

var testkey = "01-set.js"

function set_with_cas(cas) {
    cb.set(testkey, "bar", 0, cas,
	   function (data, error, key, cas) {
	       if (error) {
		   console.log("Failed to store object");
		   process.exit(1);
	       } else {
		   var exitcode = 0;
		   if (key != testkey) {
		       console.log("Callback called with wrong key!");
		       exitcode = 1;
		   }

		   process.exit(exitcode);
	       }
	   }
	  );
}

cb.set(testkey, "bar", 0, undefined,
       function (data, error, key, cas) {
	   if (error) {
	       console.log("Failed to store object");
	       process.exit(1);
	   } else {
	       var exitcode = 0;
	       if (key != testkey) {
		   console.log("Callback called with wrong key!");
		   exitcode = 1;
	       }

	       set_with_cas(cas);
	   }
       }
      );
