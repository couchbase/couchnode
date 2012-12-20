var setup = require('./setup'),
    assert = require('assert');

setup.plan(7);

setup(function(err, cb) {
    assert(!err, "setup failure");

    cb.on("error", function (message) {
        console.log("ERROR: [" + message + "]");
        process.exit(1);
    });

    // These following two tests will fail because both append and prepend require the key to
    // already exist (with set or add) before they can modify it.
    var appendKey = "Append"
    cb.append(appendKey, 'willnotwork', function (err, failMeta){
        assert(err, 'Key must exist before append will work');
        assert.equal(appendKey, failMeta.id, "Callback called with wrong key!")
        setup.end();
    });

    var prependKey = "Prepend"
    cb.prepend(prependKey, 'willnotwork', function (err, failMeta){
        assert(err, 'Key must exist before prepend will work');
        assert.equal(prependKey, failMeta.id, "Callback called with wrong key!")
        setup.end();
    });

    //Now do the rest of the tests
    var functions = ["prepend", "append"];
    var types = ["withoutCas", "withCas", "wrongCas"];
    testAll (cb, functions,types);
})


function testIt(cb, key, func, type, badMeta) {
    //Setup the key
    cb.set(key, "foo", function (err, setMeta) {
        assert(!err, "Failed to store object");
        var meta = type == "withCas" ? setMeta : (type == 'wrongCas' ? badMeta : {});

        //cb.append or cb.prepend
        cb[func](key, "bar", meta, function (err, modMeta) {
            assert.equal(key, modMeta.id, "Callback called with wrong key!")
            if (type == "wrongCas") {
                assert(err, "Cannot " + func + " with wrong cas");
                confirmKeyValue(cb, key, "foo");
            } else {
                assert(!err, "Failed to "+func);
                confirmKeyValue(cb, key, func == "prepend" ? "barfoo" : "foobar");
            }
        })
    })
}

function confirmKeyValue(cb, key, expectedValue) {
    cb.get(key, function (err, doc, getMeta) {
        assert(!err, "Failed to get value");
        assert.equal(doc, expectedValue, "Wrong value was returned. Expected:" + expectedValue + " Received:" + doc);
        cb.remove(key, function (err, meta) {});
        setup.end();
    });
}

function testWithWrongCas(cb, key,func, type) {
    cb.set(key, 'wrongCas', function (err, setMeta) {
        assert(!err, "Failed to store object");
        testIt(cb, key, func, type, setMeta);
    })
    cb.remove(key, function (err, meta) {});
}

function testAll(cb, testFunctions, testTypes ) {
    for (var i = 0, functionsCount = testFunctions.length; i < functionsCount; i++) {
        var func = testFunctions[i];
        for (var j = 0, typesCount = testTypes.length; j < typesCount; j++ ) {
            var type = testTypes[j];
            if (type == "wrongCas") testWithWrongCas(cb, func+type, func, type);
            else testIt(cb, func+type, func, type);
        }
    }
}
