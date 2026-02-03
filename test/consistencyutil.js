const { performance } = require('perf_hooks')
const http = require('http')
const MANAGEMENT_PORT = 8091
const VIEWS_PORT = 8092

class ConsistencyUtils {
  constructor(hostname, auth) {
    this.hostname = hostname
    this.auth = auth
  }

  resourceIsPresent(statusCode) {
    return statusCode === 200
  }

  resourceIsDropped(statusCode) {
    return statusCode === 404
  }

  async waitUntilUserPresent(userName, domain = 'local') {
    console.debug(`waiting until user ${userName} present on all nodes`)
    await this.waitUntilAllNodesMatchPredicate(
      `/settings/rbac/users/${domain}/${userName}`,
      this.resourceIsPresent,
      `User ${userName} is not present on all nodes`,
      true,
      MANAGEMENT_PORT
    )
  }

  async waitUntilUserDropped(userName, domain = 'local') {
    console.debug(`waiting until user ${userName} dropped on all nodes`)
    await this.waitUntilAllNodesMatchPredicate(
      `/settings/rbac/users/${domain}/${userName}`,
      this.resourceIsDropped,
      `User ${userName} is not dropped on all nodes`,
      true,
      MANAGEMENT_PORT
    )
  }

  async waitUntilGroupPresent(groupName) {
    console.debug(`waiting until group ${groupName} present on all nodes`)
    await this.waitUntilAllNodesMatchPredicate(
      `/settings/rbac/groups/${groupName}`,
      this.resourceIsPresent,
      `Group ${groupName} is not present on all nodes`,
      true,
      MANAGEMENT_PORT
    )
  }

  async waitUntilGroupDropped(groupName) {
    console.debug(`waiting until group ${groupName} dropped on all nodes`)
    await this.waitUntilAllNodesMatchPredicate(
      `/settings/rbac/groups/${groupName}`,
      this.resourceIsDropped,
      `Group ${groupName} is not dropped on all nodes`,
      true,
      MANAGEMENT_PORT
    )
  }

  async waitUntilBucketPresent(bucketName) {
    console.debug(`waiting until bucket ${bucketName} present on all nodes`)
    await this.waitUntilAllNodesMatchPredicate(
      `/pools/default/buckets/${bucketName}`,
      this.resourceIsPresent,
      `Bucket ${bucketName} is not present on all nodes`,
      true,
      MANAGEMENT_PORT
    )
  }

  async waitUntilBucketDropped(bucketName) {
    console.debug(`waiting until bucket ${bucketName} dropped on all nodes`)
    await this.waitUntilAllNodesMatchPredicate(
      `/pools/default/buckets/${bucketName}`,
      this.resourceIsDropped,
      `Bucket ${bucketName} is not dropped on all nodes`,
      true,
      MANAGEMENT_PORT
    )
  }

  async waitUntilDesignDocumentPresent(bucketName, designDocumentName) {
    console.debug(
      `waiting until design document ${designDocumentName} present on all nodes`
    )
    await this.waitUntilAllNodesMatchPredicate(
      `/${bucketName}/_design/${designDocumentName}`,
      this.resourceIsPresent,
      `Design document ${designDocumentName} on bucket ${bucketName} is not present on all nodes`,
      true,
      VIEWS_PORT
    )
  }

  async waitUntilDesignDocumentDropped(bucketName, designDocumentName) {
    console.debug(
      `waiting until design document ${designDocumentName} dropped on all nodes`
    )
    await this.waitUntilAllNodesMatchPredicate(
      `/${bucketName}/_design/${designDocumentName}`,
      this.resourceIsDropped,
      `Design document ${designDocumentName} on bucket ${bucketName} is not dropped on all nodes`,
      true,
      VIEWS_PORT
    )
  }

  async waitUntilViewPresent(bucketName, designDocumentName, viewName) {
    console.debug(`Waiting until view ${viewName} present on all nodes`)
    await this.waitUntilAllNodesMatchPredicate(
      `/${bucketName}/_design/${designDocumentName}/_view/${viewName}`,
      this.resourceIsPresent,
      `View ${viewName} on design document ${designDocumentName} on bucket ${bucketName} is not present on all nodes`,
      true,
      VIEWS_PORT
    )
  }

  async waitUntilViewDropped(bucketName, designDocumentName, viewName) {
    console.debug(`Waiting until view ${viewName} dropped on all nodes`)
    await this.waitUntilAllNodesMatchPredicate(
      `/${bucketName}/_design/${designDocumentName}/_view/${viewName}`,
      this.resourceIsDropped,
      `View ${viewName} on design document ${designDocumentName} on bucket ${bucketName} is not dropped on all nodes`,
      true,
      VIEWS_PORT
    )
  }

  async waitUntilScopePresent(bucketName, scopeName) {
    console.debug(`Waiting until scope ${scopeName} present on all nodes`)
    const scopePresent = (response) => {
      for (const scope of response.scopes) {
        if (scope.name === scopeName) {
          return true
        }
      }
      return false
    }

    await this.waitUntilAllNodesMatchPredicate(
      `/pools/default/buckets/${bucketName}/scopes`,
      scopePresent,
      `Scope ${scopeName} on bucket ${bucketName} is not present on all nodes`,
      false,
      MANAGEMENT_PORT
    )
  }

  async waitUntilScopeDropped(bucketName, scopeName) {
    console.debug(`Waiting until scope ${scopeName} dropped on all nodes`)
    const scopeDropped = (response) => {
      for (const scope of response.scopes) {
        if (scope.name === scopeName) {
          return false
        }
      }
      return true
    }

    await this.waitUntilAllNodesMatchPredicate(
      `/pools/default/buckets/${bucketName}/scopes`,
      scopeDropped,
      `Scope ${scopeName} on bucket ${bucketName} is not dropped on all nodes`,
      false,
      MANAGEMENT_PORT
    )
  }

  async waitUntilCollectionPresent(bucketName, scopeName, collectionName) {
    console.debug(
      `Waiting until collection ${collectionName} present on all nodes`
    )
    const collectionPresent = (response) => {
      for (const scope of response.scopes) {
        if (scope.name === scopeName) {
          for (const collection of scope.collections) {
            if (collection.name === collectionName) {
              return true
            }
          }
        }
      }
      return false
    }

    await this.waitUntilAllNodesMatchPredicate(
      `/pools/default/buckets/${bucketName}/scopes`,
      collectionPresent,
      `collection ${collectionName} on scope ${scopeName} on bucket ${bucketName} is not present on all nodes`,
      false,
      MANAGEMENT_PORT
    )
  }

  async waitUntilCollectionDropped(bucketName, scopeName, collectionName) {
    console.debug(
      `Waiting until collection ${collectionName} dropped on all nodes`
    )
    const collectionDropped = (response) => {
      for (const scope of response.scopes) {
        if (scope.name === scopeName) {
          for (const collection of scope.collections) {
            if (collection.name === collectionName) {
              return false
            }
          }
        }
      }
      return true
    }

    await this.waitUntilAllNodesMatchPredicate(
      `/pools/default/buckets/${bucketName}/scopes`,
      collectionDropped,
      `collection ${collectionName} on scope ${scopeName} on bucket ${bucketName} is not dropped on all nodes`,
      false,
      MANAGEMENT_PORT
    )
  }

  async waitUntilCustomPredicate(
    path,
    predicate,
    onlyStatusCode = false,
    port = 8091,
    errorMsg = 'Error matching custom predicate'
  ) {
    await this.waitUntilAllNodesMatchPredicate(
      path,
      predicate,
      errorMsg,
      onlyStatusCode,
      port
    )
  }

  async waitUntilAllNodesMatchPredicate(
    path,
    predicate,
    errorMsg,
    onlyStatusCode,
    port
  ) {
    try {
      const deadline = performance.now() + 2000
      while (performance.now() < deadline) {
        const predicateMatched = await this.allNodesMatchPredicate(
          path,
          predicate,
          onlyStatusCode,
          port
        )
        if (predicateMatched) {
          return
        } else {
          await this.sleep(10)
        }
      }
      throw new Error('Timed out waiting for nodes to match predicate')
    } catch (e) {
      throw new Error(`${errorMsg} - ${e}`)
    }
  }

  async allNodesMatchPredicate(path, predicate, onlyStatusCode, port) {
    for (const node in this.nodes) {
      const request = {
        hostname: node.split(':')[0],
        port: port,
        path: path,
        auth: this.auth,
      }
      const response = await this.runHttpRequest(request, onlyStatusCode)
      const predicateMatched = predicate(response)
      if (!predicateMatched) {
        return false
      }
    }
    return true
  }

  runHttpRequest(httpRequest, onlyStatusCode) {
    return new Promise((resolve, reject) => {
      const req = http.get(httpRequest, (res) => {
        if (onlyStatusCode) {
          return resolve(res.statusCode)
        } else if (res.statusCode !== 200) {
          reject('Non 200 status code from response')
        }
        const data = []
        let info = {}
        res.on('data', (chunk) => {
          data.push(chunk)
        })
        res.on('end', () => {
          try {
            info = JSON.parse(data)
          } catch (e) {
            reject(e)
          }
          resolve(info)
        })
      })
      req.on('error', (e) => {
        reject(e.message)
      })
      req.end()
    })
  }

  async waitForConfig(isMock) {
    if (isMock) {
      this.nodes = {}
      return
    }

    const start = performance.now()

    while (true) {
      try {
        const config = await this.getConfig()

        if (config.length !== 0) {
          this.nodes = config
          return
        }

        await this.sleep(10)
      } catch (e) {
        console.error('Ignoring error waiting for config: ' + e.toString())
      }
      if (performance.now() - start > 2000) {
        throw new Error('Timeout waiting for config')
      }
    }
  }

  getConfig() {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: this.hostname,
        port: 8091,
        path: '/pools/nodes',
        auth: this.auth,
      }
      const req = http.get(options, (res) => {
        if (res.statusCode !== 200) {
          return reject(new Error('statusCode=' + res.statusCode))
        }
        const data = []
        const nodeInfo = {}
        res.on('data', (chunk) => {
          data.push(chunk)
        })
        res.on('end', () => {
          try {
            const nodeData = JSON.parse(data)
            for (const node of nodeData.nodes) {
              nodeInfo[node.configuredHostname] = node.services
            }
          } catch (e) {
            reject(e)
          }
          resolve(nodeInfo)
        })
      })
      req.on('error', (e) => {
        reject(e.message)
      })
      req.end()
    })
  }

  sleep(ms = 0) {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

module.exports = ConsistencyUtils
