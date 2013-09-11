/* Bench.js
 * Config params: bench_config object
 * @param num_clients - Number of concurrent connections
 * @param command - Accepts SET/GET
 * @param warm_up - Count of warm up operations
 * @param num_requests - Number of requests executed by all clients
 * To Run from command line: node bench <clients> <command> <requests>
 */
var couchbase = require('../lib/couchbase.js'),
    cb_config = { host :  [ "localhost:8091" ],
        bucket : "default"
    },
    bench_config = { verbose : false, /* print response times */
        num_clients : parseInt(process.argv[2],10) || 5,
        command : process.argv[3] || "SET",
        warm_up : 100,
        num_requests : parseInt(process.argv[4],10) || 5000,
        timeout : 60000 /* TODO: request time out */
    },
    clients = {},
    stats = {
        add_result : function(res_time){
            stats.res_times.push(res_time);
            if(!bench_config.verbose){
                stats.duration = Date.now() - stats.start_time;
                stats.rps =  (stats.completed_requests / (stats.duration/1000)).toFixed(2)
                process.stdout.write(bench_config.command+ " "+stats.rps+" ops/s \r");
            }
        },
        completed_requests : 0,
        res_times : [],
        start_time : 0 ,
        duration : 0,
        min : 0,
        max : 0,
        avg : 0,
        ninetyfive_percentile : 0
    };

var get_test = function(type){
    switch(type){
        case "GET":
            return function(client, callback){
                client.get("key" + Math.random(),function(){
                        callback();
                        });
            }
        case "SET":
            return function(client, callback){
                client.set("key"+ Math.random(), "value"+ Math.random(), function(){
                        callback();
                        });
            }
    }
}
var print_results = function(){
    stats.duration = Date.now() - stats.start_time;
    stats.rps = (bench_config.num_requests / (stats.duration/1000)).toFixed(2);

    var len = stats.res_times.length;
    stats.res_times.sort();
    stats.min = stats.res_times[0];
    stats.max = stats.res_times[len - 1];
    stats.ninetyfive_percentile = stats.res_times[len - (len * 0.05) -1];
    stats.avg = (stats.res_times.sum()/len).toFixed(2);
    console.log("=============================================");
    console.log("\t"+bench_config.command);
    console.log("\tParallel Clients: " + bench_config.num_clients
            + "\n\tRequests Completed: " +  bench_config.num_requests
            + "\n\tThroughput: "+stats.rps + " ops/s"
            + "\n\tTotal: " + stats.duration+" ms"
            + "\n\tMin: "+ stats.min + " s"
            + "\n\tAvg: "+ stats.avg + " s"
            + "\n\tMax: " + stats.max + " s"
            + "\n\t95p: " + stats.ninetyfive_percentile+" s");

    console.log("=============================================");
    process.exit(0);

}

var start_requests = function(){
    var served_requests = 0,
        sent_requests = 0;
    test = get_test(bench_config.command);
    stats.start_time = Date.now();

    while(sent_requests != bench_config.num_requests){
        var connection_id = sent_requests % bench_config.num_clients;

        (function(id, req_number){
         var req_begin_time = Date.now();
         if(bench_config.verbose){
            console.log("Connection:"+id
                        + " Request:"+req_number);
         }
         test(clients[id], function(){
             served_requests++;
             res_time = ((Date.now() - req_begin_time)/1000).toFixed(2);
             stats.completed_requests = served_requests;
             stats.add_result(res_time);
             if(bench_config.verbose){
                console.log("Response Time:"+res_time
                            +" for Connection:"+id
                            +" Request:"+req_number);
             }
             if(served_requests == bench_config.num_requests){
                print_results();
             }
             });
         })(connection_id, sent_requests);

        sent_requests++;
    }
};

var start_warm_up_requests = function(){
    var warm_up_requests = 0,
        served_warm_up_requests = 0,
        test = get_test(bench_config.command);

    while(warm_up_requests != bench_config.warm_up){
        var connection_id = warm_up_requests % bench_config.num_clients;

        (function(id){
         test(clients[id], function(){
             served_warm_up_requests++;
             if(served_warm_up_requests == bench_config.warm_up){
                start_requests();
             }
             });
         })(connection_id);

        warm_up_requests++;
    }

};

var start_test = function(){
    var connections_established = 0;

    for(var i=0; i < bench_config.num_clients; i++){
        (function(id) {
             var client = new couchbase.Connection(cb_config, function(err) {
             if(err) {
                console.log("ERR: Unable to connect to Server");
                process.exit(1);
             };
             clients[id] = client;
             connections_established++;

             if(connections_established == bench_config.num_clients){
                if(bench_config.warmup > 0){
                    start_warm_up_requests();
                } else{
                    start_requests();
                }
             }

             });
         })(i);
    }
}

start_test();

Array.prototype.sum = function(){
    for (var i = 0, sum = 0 ; i != this.length; ++i) {
        var n = parseFloat(this[i]);
        sum += n;
    }
    return sum;
};
