'use strict';

const assert = require('chai').assert
const H = require('./harness');

function genericTests(collFn) {
  describe('#basic', () => {
    const testKeyA = H.genTestKey();

    describe('#upsert', () => {
      it('should perform basic upserts', async () => {
        var res = await collFn().upsert(testKeyA, {
          foo: 'bar',
          baz: 19
        });
        assert.isObject(res);
        assert.isNotEmpty(res.cas);
      });
    });

    describe('#get', () => {
      it('should perform basic gets', async () => {
        var res = await collFn().get(testKeyA);
        assert.isObject(res);
        assert.isNotEmpty(res.cas);
        assert.deepStrictEqual(res.value, {
          foo: 'bar',
          baz: 19
        });
      });

      it('should perform projected gets', async () => {
        var res = await collFn().get(testKeyA, {
          project: [
            'baz'
          ]
        });
        assert.isObject(res);
        assert.isNotEmpty(res.cas);
        assert.deepStrictEqual(res.value, { baz: 19 });
      });
    });

    describe('#getFromReplica', () => {
      it.skip('should perform basic gets from replicas',
        async () => {
          var res = await collFn().getFromReplica(testKeyA, H
            .lib
            .ReplicaMode.Any);
          assert.isObject(res);
          assert.isNotEmpty(res.cas);
          assert.deepStrictEqual(res
            .value, { foo: 'bar' });
        });
    });

    describe('#replace', () => {
      it('should replace data correctly', async () => {
        var res = await collFn().replace(
          testKeyA, { foo: 'baz' });
        assert.isObject(res);
        assert.isNotEmpty(res.cas);

        var gres = await collFn().get(testKeyA);
        assert.deepStrictEqual(gres
          .value, { foo: 'baz' });
      });
    });

    describe('#remove', () => {
      it('should perform basic removes', async () => {
        var res = await collFn().remove(testKeyA);
        assert.isObject(res);
        assert.isNotEmpty(res.cas);
      });
    });

    describe('#insert', () => {
      const testKeyIns = H.genTestKey();

      it('should perform inserts correctly', async () => {
        var res = await collFn().insert(
          testKeyIns, { foo: 'bar' });
        assert.isObject(res);
        assert.isNotEmpty(res.cas);
      });

      it('should fail to insert a second time', async () => {
        await H.throwsHelper(async () => {
          await collFn().insert(
            testKeyIns, { foo: 'bar' });
        });
      });

      it('should remove the insert test key', async () => {
        await collFn().remove(testKeyIns);
      });

      it('should insert w/ expiry successfully',
        async () => {
          const testKeyExp = H.genTestKey();

          var res = await collFn().insert(
            testKeyExp, { foo: 14 }, { expiry: 1 });
          assert.isObject(res);
          assert.isNotEmpty(res.cas);

          await H.sleep(2000);

          await H.throwsHelper(async () => {
            await collFn().get(testKeyExp);
          });
        }).timeout(4000);
    });

    describe('#touch', () => {
      it('should touch a document successfully',
        async () => {
          const testKeyTch = H.genTestKey();

          // Insert a test document
          var res = await collFn().insert(
            testKeyTch, { foo: 14 }, { expiry: 2 });
          assert.isObject(res);
          assert.isNotEmpty(res.cas);

          // Ensure the key is there
          await collFn().get(testKeyTch);

          // Touch the document
          var res = await collFn().touch(testKeyTch, 4);
          assert.isObject(res);
          assert.isNotEmpty(res.cas);

          // Wait for the first expiry
          await H.sleep(3000);

          // Ensure the key is still there
          await collFn().get(testKeyTch);

          // Wait for it to expire
          await H.sleep(2000);

          // Ensure the key is gone
          await H.throwsHelper(async () => {
            await collFn().get(testKeyTch);
          });
        }).timeout(6500);
    });

    describe('#getAndTouch', () => {
      it('should touch a document successfully',
        async () => {
          const testKeyGat = H.genTestKey();

          // Insert a test document
          var res = await collFn().insert(
            testKeyGat, { foo: 14 }, { expiry: 2 });
          assert.isObject(res);
          assert.isNotEmpty(res.cas);

          // Ensure the key is there
          await collFn().get(testKeyGat);

          // Touch the document
          var res = await collFn().getAndTouch(testKeyGat, 4);
          assert.isObject(res);
          assert.isNotEmpty(res.cas);
          assert.deepStrictEqual(res.value, { foo: 14 });

          // Wait for the first expiry
          await H.sleep(3000);

          // Ensure the key is still there
          await collFn().get(testKeyGat);

          // Wait for it to expire
          await H.sleep(2000);

          // Ensure the key is gone
          await H.throwsHelper(async () => {
            await collFn().get(testKeyGat);
          });
        }).timeout(6500);
    });
  });

  describe('#binary', () => {
    var testKeyBin = H.genTestKey();

    before(async () => {
      await collFn().insert(testKeyBin, 14);
    });

    after(async () => {
      await collFn().remove(testKeyBin);
    });

    describe('#increment', () => {
      it('should increment successfully', async () => {
        var res = await collFn().binary().increment(
          testKeyBin,
          3);
        assert.isObject(res);
        assert.isNotEmpty(res.cas);
        assert.deepStrictEqual(res.value, 17);

        var gres = await collFn().get(testKeyBin);
        assert.deepStrictEqual(gres.value, 17);
      });
    });

    describe('#decrement', () => {
      it('should decrement successfully', async () => {
        var res = await collFn().binary().decrement(
          testKeyBin,
          4);
        assert.isObject(res);
        assert.isNotEmpty(res.cas);
        assert.deepStrictEqual(res.value, 13);

        var gres = await collFn().get(testKeyBin);
        assert.deepStrictEqual(gres.value, 13);
      });
    });

    describe('#append', () => {
      it('should append successfuly', async () => {
        var res = await collFn().binary().append(testKeyBin,
          'world');
        assert.isObject(res);
        assert.isNotEmpty(res.cas);

        var gres = await collFn().get(testKeyBin);
        // TODO: Decide if this should actually return a Buffer?
        assert.isTrue(Buffer.isBuffer(gres.value));
        assert.deepStrictEqual(gres.value.toString(),
          '13world');
      });
    });

    describe('#prepend', () => {
      it('should prepend successfuly', async () => {
        var res = await collFn().binary().prepend(
          testKeyBin,
          'hello');
        assert.isObject(res);
        assert.isNotEmpty(res.cas);

        var gres = await collFn().get(testKeyBin);
        assert.isTrue(Buffer.isBuffer(gres.value));
        assert.deepStrictEqual(gres.value.toString(),
          'hello13world');
      });
    });
  });

  describe('#locks', () => {
    const testKeyLck = H.genTestKey();

    before(async () => {
      await collFn().insert(testKeyLck, { foo: 14 });
    });

    after(async () => {
      await collFn().remove(testKeyLck);
    });

    it('should lock successfully', async () => {
      // Try and lock the key
      var res = await collFn().getAndLock(testKeyLck, 1);
      assert.isObject(res);
      assert.isNotEmpty(res.cas);
      assert.deepStrictEqual(res.value, { foo: 14 });
      var prevCas = res.cas;

      // Make sure its actually locked
      await H.throwsHelper(async () => {
        await collFn().upsert(testKeyLck, { foo: 9 });
      });

      // Ensure we can upsert with the cas
      await collFn().upsert(
        testKeyLck, { foo: 9 }, { cas: prevCas });
    });

    it('should unlock successfully', async () => {
      // Lock the key for testing
      var res = await collFn().getAndLock(testKeyLck, 1);
      var prevCas = res.cas;

      // Manually unlock the key
      var res = await collFn().unlock(testKeyLck, prevCas);
      assert.isObject(res);
      assert.isNotEmpty(res.cas);

      // Make sure our get works now
      await collFn().upsert(testKeyLck, { foo: 14 });
    });
  });

  describe('subdoc', () => {
    const testKeySd = H.genTestKey();

    before(async () => {
      await collFn().insert(testKeySd, {
        foo: 14,
        bar: 2,
        baz: 'hello'
      });
    });

    after(async () => {
      await collFn().remove(testKeySd);
    });

    it('should lookupIn successfully', async () => {
      var res = await collFn().lookupIn(testKeySd, [
        H.lib.LookupInSpec.get('baz'),
        H.lib.LookupInSpec.get('bar')
      ]);
      assert.isObject(res);
      assert.isNotEmpty(res.cas);
      assert.isArray(res.results);
      assert.strictEqual(res.results.length, 2);
      assert.isNotOk(res.results[0].error);
      assert.deepStrictEqual(res.results[0].value, 'hello');
      assert.isNotOk(res.results[1].error);
      assert.deepStrictEqual(res.results[1].value, 2);
    });

    it('should mutateIn successfully', async () => {
      var res = await collFn().mutateIn(testKeySd, [
        H.lib.MutateInSpec.increment('bar', 3)
      ]);
      assert.isObject(res);
      assert.isNotEmpty(res.cas);

      var gres = await collFn().get(testKeySd);
      assert.isOk(gres.value);
      assert.deepStrictEqual(gres.value.bar, 5);
    });
  });
}

describe('#crud', () => {
  genericTests(() => H.dco);
});

describe('#collections-crud', () => {
  H.requireFeature(H.Features.Collections, () => {
    genericTests(() => H.co);
  });
});
