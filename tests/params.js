exports.params = {
    "hostname" : "localhost:8091",
    "username" : null,
    "password" : null,
    "bucket" : null,
    "count" : 10,
    "callstyle" : 'dict'
};

var option_map = {
    'H' : 'hostname',
    'u' : 'username',
    'p' : 'password',
    'b' : 'bucket',
    'c' : 'count',
    'S' : 'callstyle'
};

exports.parse_cliargs = function () {
    for (var ii = 2; ii < process.argv.length; ii++) {
        var cli_switch = process.argv[ii];
        var next_arg = process.argv[ii+1];
        var key = cli_switch[1];

        if (cli_switch == "--help" ||
                cli_switch == '-h' ||
                cli_switch == '-?') {
                    console.log("Usage\n" +
                            "-- Connection Options --\n"+
                            "\t-H HOSTNAME\n" +
                            "\t-u USERNAME\n" +
                            "\t-p PASSWORD\n" +
                            "\t-b BUCKET\n" +
                            
                            "-- Test Options --\n" +
                            "\t-S <dict|positional>\n" +
                            "\t-c NUM_HANDLES"
                            );
                    process.exit(0);
                }

        if (!option_map[key]) {
            msg = "Unrecognized argument " + cli_switch;
            throw msg;
        }
        if (!next_arg) {
            throw "Option " + cli_switch + " requires an argument";
        }

        if (next_arg) {
            exports.params[ option_map[key] ] = next_arg;
        }

        ii++;
    }
};

exports.create_handle = function() {
    var driver = require('couchbase');
    exports.parse_cliargs();
    
    var cb = new driver.Couchbase(
        exports.params['hostname'],
        exports.params['username'],
        exports.params['password'],
        exports.params['bucket']
    );
    return cb;
};