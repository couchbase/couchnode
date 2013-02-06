var setup = require('./setup'),
    assert = require('assert');

setup.plan(7)

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    // things that should work
    assert.doesNotThrow(function() {
        cb.get("has callback", setup.end)
    })

    assert.doesNotThrow(function() {
        cb.set("has callback", "value", setup.end)
    })

    assert.doesNotThrow(function() {
        // falsy values for CAS and exp
        [null, undefined, 0, false].forEach(function(fv) {
            cb.set("has falsy meta", "value", {cas : fv, exp : fv}, setup.end)
        })
    })

    // things that should error
    assert.throws(function() {
        cb.get("needs callback")
    })

    assert.throws(function() {
        cb.set("needs callback")
    })

    setup.end()
})
