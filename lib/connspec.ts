/* eslint jsdoc/require-jsdoc: off */
import * as qs from 'querystring'

const partsMatcher = /((.*):\/\/)?(([^/?:]*)(:([^/?:@]*))?@)?([^/?]*)(\/([^?]*))?(\?(.*))?/
const hostMatcher = /((\[[^\]]+\]+)|([^;,:]+))(:([0-9]*))?(;,)?/g
const kvMatcher = /([^=]*)=([^&?]*)[&?]?/g

export class ConnSpec {
  scheme: string
  hosts: [string, number][]
  bucket: string
  options: { [key: string]: string | string[] }

  constructor(data?: Partial<ConnSpec>) {
    this.scheme = 'couchbase'
    this.hosts = [['localhost', 0]]
    this.bucket = ''
    this.options = {}

    if (data) {
      Object.assign(this, data)
    }
  }

  static parse(connStr: string): ConnSpec {
    const spec = new ConnSpec()

    if (!connStr) {
      return spec
    }

    const parts = partsMatcher.exec(connStr)
    if (!parts) {
      return spec
    }

    if (parts[2]) {
      spec.scheme = parts[2]
    } else {
      spec.scheme = 'couchbase'
    }

    if (parts[7]) {
      spec.hosts = []

      while (hostMatcher) {
        const hostMatch = hostMatcher.exec(parts[7])
        if (!hostMatch) {
          break
        }
        spec.hosts.push([
          hostMatch[1],
          hostMatch[5] ? parseInt(hostMatch[5], 10) : 0,
        ])
      }
    } else {
      throw new Error('a connection string with no hosts is illegal')
    }

    if (parts[9]) {
      spec.bucket = parts[9]
    } else {
      spec.bucket = ''
    }

    if (parts[11]) {
      spec.options = {}

      for (;;) {
        const kvMatch = kvMatcher.exec(parts[11])
        if (!kvMatch) {
          break
        }

        const optKey = qs.unescape(kvMatch[1])
        const optVal = qs.unescape(kvMatch[2])
        if (optKey in spec.options) {
          const specOptVal = spec.options[optKey]
          if (typeof specOptVal === 'string') {
            spec.options[optKey] = [specOptVal, optVal]
          } else {
            specOptVal.push(optVal)
          }
        } else {
          spec.options[optKey] = optVal
        }
      }
    } else {
      spec.options = {}
    }

    return spec
  }

  toString(): string {
    let connStr = ''

    if (this.scheme) {
      connStr += this.scheme + '://'
    }

    if (this.hosts.length === 0) {
      throw new Error('a connection string with no hosts is illegal')
    }
    for (let i = 0; i < this.hosts.length; ++i) {
      const host = this.hosts[i]
      if (i !== 0) {
        connStr += ','
      }
      connStr += host[0]
      if (host[1]) {
        connStr += ':' + host[1]
      }
    }

    if (this.bucket) {
      connStr += '/' + this.bucket
    }

    if (this.options) {
      const optParts = []

      for (const optKey in this.options) {
        const optVal = this.options[optKey]
        if (typeof optVal === 'string') {
          optParts.push(qs.escape(optKey) + '=' + qs.escape(optVal))
        } else {
          for (let optIdx = 0; optIdx < optVal.length; ++optIdx) {
            optParts.push(qs.escape(optKey) + '=' + qs.escape(optVal[optIdx]))
          }
        }
      }

      if (optParts.length > 0) {
        connStr += '?' + optParts.join('&')
      }
    }

    return connStr
  }
}
