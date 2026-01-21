'use strict'

var TEST_DOCS = [
  { x: 0, y: 0, name: 'x0,y0' },
  { x: 1, y: 0, name: 'x1,y0' },
  { x: 2, y: 0, name: 'x2,y0' },
  { x: 0, y: 1, name: 'x0,y1' },
  { x: 1, y: 1, name: 'x1,y1' },
  { x: 2, y: 1, name: 'x2,y1' },
  { x: 0, y: 2, name: 'x0,y2' },
  { x: 1, y: 2, name: 'x1,y2' },
  { x: 2, y: 2, name: 'x2,y2' },
]

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function upsertTestData(target, testUid, retries = 3) {
  var promises = []

  for (var i = 0; i < TEST_DOCS.length; ++i) {
    promises.push(
      (async () => {
        var testDocKey = testUid + '::' + i
        var testDoc = TEST_DOCS[i]
        testDoc.testUid = testUid

        for (let i = 0; i < retries; ++i) {
          try {
            await target.upsert(testDocKey, testDoc)
          } catch (e) {
            if (i === retries - 1) {
              throw e
            }
            await sleep(500)
          }
        }
        return testDocKey
      })()
    )
  }

  return await Promise.allSettled(promises)
}

async function upsertTestDataFromList(target, testUid, docList) {
  var promises = []

  for (var i = 0; i < docList.length; ++i) {
    promises.push(
      (async () => {
        var testDocKey = testUid + '::' + i
        var testDoc = docList[i]
        testDoc.testUid = testUid

        await target.upsert(testDocKey, testDoc)
        return testDocKey
      })()
    )
  }

  return await Promise.allSettled(promises)
}

module.exports.upsertData = upsertTestData
module.exports.upserDataFromList = upsertTestDataFromList

async function removeTestData(target, testDocs) {
  if (!testDocs) {
    return
  }

  let removeRes

  for (let i = 0; i < 3; i++) {
    try {
      removeRes = await Promise.allSettled(
        testDocs.map((docId) => target.remove(docId))
      )
    } catch (_e) {
      // ignore
    }

    if (
      removeRes &&
      removeRes.every(
        (r) =>
          r.status === 'fulfilled' || r.reason?.message.includes('not found')
      )
    ) {
      break
    }

    testDocs = testDocs.filter((_, idx) => {
      return removeRes
        ? removeRes[idx].status !== 'fulfilled' &&
            !removeRes[idx].reason?.message.includes('not found')
        : true
    })
  }
}

module.exports.removeTestData = removeTestData

function testDocCount() {
  return TEST_DOCS.length
}

module.exports.docCount = testDocCount
