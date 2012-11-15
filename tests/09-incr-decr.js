var setup = require('./setup'),
    assert = require('assert');


setup.plan(6); // exit at 6th call to setup.end()


setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR : [" + message + "]");
        process.exit(1);
    });


    var testkey = "09-incr-decr.js",
        testkey2 = "09-incr-decr.js2",
        testkey3 = "09-incr-decr.js3",
        testkey4 = "09-incr-decr.js4";
        testkey5 = "09-incr-decr.js5";
        testkey6 = "09-incr-decr.js6";

    cb.remove(testkey, function (err, meta) {});
    cb.remove(testkey2, function (err, meta) {});
    cb.remove(testkey3, function (err, meta) {});
    cb.remove(testkey4, function (err, meta) {});
    cb.remove(testkey5, function (err, meta) {});
    cb.remove(testkey6, function (err, meta) {});

    // Set A : minimal number of parameter (no parameter)
    cb.incr( testkey,  function(err, value, meta){
        assert.equal(value, 0, "Default Increment 1st call : value should be 0 but it is "+ value);

        cb.incr( testkey,  function(err, value, meta){
            assert.equal(value, 1, "Default Increment 2nd call : value should be 1 but it is "+ value);

            cb.incr( testkey,  function(err, value, meta){
                assert.equal(value, 2, "Default Increment 3rd call : value should be 2 but it is "+ value);

                cb.decr( testkey,  function(err, value, meta){
                    assert.equal(value, 1, "Default Decrement : value should be 1 but it is "+ value);
                    setup.end();
                });

            });
        });
    });


    // Set B : User 1 parameter : offset
    cb.incr( testkey2,  {offset : 10},  function(err, value, meta){
        assert.equal(value, 0, "Default Increment 1st call with 10 : value should be 0 but it is "+ value);

        cb.incr( testkey2,  {offset : 10},  function(err, value, meta){
            assert.equal(value, 10,  "Default Increment 2nd call with 10 : value should be 10 but it is "+ value);

            cb.incr( testkey2, {offset : 5},  function(err, value, meta){
                assert.equal(value, 15, "Default Increment 3rd call with 5 : value should be 15 but it is "+ value);

                cb.decr( testkey2, {offset : 10},  function(err, value, meta){
                    assert.equal(value, 5, "Default Decrement with 10 : value should be 5 but it is "+ value);
                    setup.end();
                });
            });
        });
    });


    // Set C : Test Default value
    cb.incr( testkey3,  {defaultValue : 100}, function(err, value, meta){
        assert.equal(value, 100, "Default Increment test default value : value should be 100 but it is "+ value);
        setup.end();
    });


    cb.decr( testkey4,  {defaultValue : 100}, function(err, value, meta){

        assert.equal(value, 100, "Default Decrement test default value : value should be 100 but it is "+ value);

        cb.decr( testkey4,  {offset : 90}, function(err, value, meta){
            assert.equal(value, 10, "Default Decrement test default value : value should be 10 but it is "+ value);
            setup.end();
        });


    });


    // Set D : Test with expiry (not testing the expiry just the parameters)
    cb.incr( testkey5,  {expiry : 5}, function(err, value, meta){
        assert.equal(value, 0, "Default Increment test default value : value should be 0 but it is "+ value);
        setup.end();
    });


    cb.decr( testkey6,  {defaultValue : 50, expiry : 5}, function(err, value, meta){
        assert.equal(value, 50, "Default Decrement test default value : value should be 50 but it is "+ value);
        setup.end();
    });

})