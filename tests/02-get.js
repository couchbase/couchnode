var config = require('./config')
var cb = config.create_cluster_handle();

cb.on("error",
      function (message) {
	  console.log("ERROR: [" + message + "]");
	  process.exit(1);
      }
     );

var num_callbacks = 0;

cb.set("key0", "value", 0, undefined,
       function (data, error, key, cas) {
	   if (error) {
	       console.log("Failed to store object");
	       process.exit(1);
	   }

	   ++num_callbacks;
	   cb.get("key0", undefined,
		  function (data, error, key, cas, flags, value) {
		      if (error) {
			  console.log("Object should exist!");
			  process.exit(1);
		      }

		      process.exit(0);
		  });
       });

