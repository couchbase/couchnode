var params = require('./params');
var cb = params.create_handle();


// Verify simple stuff don't crap out:
cb._opCallStyle('dict');
cb.get("foo", function(){});
cb.set("foo", "bar", function(){});
cb.delete("foo", function(){});
cb.arithmetic("foo", 0, function(){});


// These things should fail:

function must_fail(fn, args) {
    var exc = null;
    try {
        fn.apply(cb, args);
    } catch (err) {
        exc = err;
    }
    if (!exc) {
        msg = "Expected error for arguments " +
            args + " and function " + fn.name;
        throw msg;
    }
};

// Must have callback
must_fail(cb.get, ["foo"]);
must_fail(cb.set, ["foo"]);

// CAS processing...
must_fail(cb.set, ["foo", "bar", function(){}, { cas : "invalid"} ]);


// Ensure all these false-ish values don't error for cas or expiry..
var falsevals = [null, undefined, 0, false];
for (var ii = 0; ii < falsevals.length; ii++) {
    var fv = falsevals[ii];
    try {
        cb.set("foo", "bar", function(){},
               { exp : fv, cas : fv });
    } catch (err) {
        throw err + " for value " + fv;
    }
}

// Check that the positional tests work..
cb._opCallStyle('positional');
cb.get("foo", 0, function(){});
cb.set("foo", "bar", 0, 0, function(){});
cb.delete("foo", 0, function(){});
cb.arithmetic("foo", 0, 0, 0, 0, function(){});

must_fail(cb.get, ["foo"]);
must_fail(cb.set, ["foo", "bar"]);
must_fail(cb.arithmetic, ["foo"]);
must_fail(cb.remove, ["foo"]);

process.exit(0);