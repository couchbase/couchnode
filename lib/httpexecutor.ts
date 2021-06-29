/* eslint jsdoc/require-jsdoc: off */
import binding from './binding'
import { Connection } from './connection'
import { HttpErrorContext } from './errorcontexts'
import { RequestSpan } from './tracing'
import * as events from 'events'

/**
 * @internal
 */
export enum HttpServiceType {
  Management = 'MGMT',
  Views = 'VIEW',
  Query = 'QUERY',
  Search = 'SEARCH',
  Analytics = 'ANALYTICS',
}

/**
 * @internal
 */
export enum HttpMethod {
  Get = 'GET',
  Post = 'POST',
  Put = 'PUT',
  Delete = 'DELETE',
}

/**
 * @internal
 */
export interface HttpRequestOptions {
  type: HttpServiceType
  method: HttpMethod
  path: string
  contentType?: string
  body?: string | Buffer
  parentSpan?: RequestSpan
  timeout?: number
}

/**
 * @internal
 */
export interface HttpResponse {
  requestOptions: HttpRequestOptions
  statusCode: number
  headers: { [key: string]: string }
  body: Buffer
}

/**
 * @internal
 */
export class HttpExecutor {
  private _conn: Connection

  /**
   * @internal
   */
  constructor(conn: Connection) {
    this._conn = conn
  }

  streamRequest(options: HttpRequestOptions): events.EventEmitter {
    const emitter = new events.EventEmitter()

    let lcbHttpType
    if (options.type === HttpServiceType.Management) {
      lcbHttpType = binding.LCB_HTTP_TYPE_MANAGEMENT
    } else if (options.type === HttpServiceType.Views) {
      lcbHttpType = binding.LCB_HTTP_TYPE_VIEW
    } else if (options.type === HttpServiceType.Query) {
      lcbHttpType = binding.LCB_HTTP_TYPE_QUERY
    } else if (options.type === HttpServiceType.Search) {
      lcbHttpType = binding.LCB_HTTP_TYPE_SEARCH
    } else if (options.type === HttpServiceType.Analytics) {
      lcbHttpType = binding.LCB_HTTP_TYPE_ANALYTICS
    } else {
      throw new Error('unexpected http request type')
    }

    let lcbHttpMethod
    if (options.method === HttpMethod.Get) {
      lcbHttpMethod = binding.LCB_HTTP_METHOD_GET
    } else if (options.method === HttpMethod.Post) {
      lcbHttpMethod = binding.LCB_HTTP_METHOD_POST
    } else if (options.method === HttpMethod.Put) {
      lcbHttpMethod = binding.LCB_HTTP_METHOD_PUT
    } else if (options.method === HttpMethod.Delete) {
      lcbHttpMethod = binding.LCB_HTTP_METHOD_DELETE
    } else {
      throw new Error('unexpected http request method')
    }

    const lcbTimeout = options.timeout ? options.timeout * 1000 : undefined
    this._conn.httpRequest(
      lcbHttpType,
      lcbHttpMethod,
      options.path,
      options.contentType,
      options.body,
      options.parentSpan,
      lcbTimeout,
      (err, flags, data) => {
        if (!(flags & binding.LCBX_RESP_F_NONFINAL)) {
          if (err) {
            emitter.emit('error', err)
            return
          }

          // data will be an object
          emitter.emit('end', data)
          return
        }

        if (err) {
          throw new Error('unexpected error on non-final callback')
        }

        // data will be a buffer
        emitter.emit('data', data)
      }
    )

    return emitter
  }

  async request(options: HttpRequestOptions): Promise<HttpResponse> {
    return new Promise((resolve, reject) => {
      const emitter = this.streamRequest(options)

      emitter.on('error', (err) => {
        reject(err)
      })

      let dataCache = Buffer.allocUnsafe(0)
      emitter.on('data', (data) => {
        dataCache = Buffer.concat([dataCache, data])
      })

      emitter.on('end', (meta) => {
        const headers: { [key: string]: string } = {}
        for (let i = 0; i < meta.headers.length; i += 2) {
          const headerName = meta.headers[i + 0]
          const headerValue = meta.headers[i + 1]

          if (headers[headerName]) {
            headers[headerName] += ',' + headerValue
          } else {
            headers[headerName] = headerValue
          }
        }

        resolve({
          requestOptions: options,
          statusCode: meta.statusCode,
          headers: headers,
          body: dataCache,
        })
      })
    })
  }

  static errorContextFromResponse(resp: HttpResponse): HttpErrorContext {
    return new HttpErrorContext({
      method: resp.requestOptions.method,
      request_path: resp.requestOptions.path,
      response_code: resp.statusCode,
      response_body: resp.body.toString(),
    })
  }
}
