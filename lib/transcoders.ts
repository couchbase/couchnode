const NF_JSON = 0x00
const NF_RAW = 0x02
const NF_UTF8 = 0x04
const NF_MASK = 0xff
const NF_UNKNOWN = 0x100

const CF_NONE = 0x00 << 24
const CF_PRIVATE = 0x01 << 24
const CF_JSON = 0x02 << 24
const CF_RAW = 0x03 << 24
const CF_UTF8 = 0x04 << 24
const CF_MASK = 0xff << 24

/**
 * Transcoders provide functionality for converting values passed to and from
 * the SDK to byte arrays and flags data that can be stored to the server.
 *
 * @category Key-Value
 */
export interface Transcoder {
  /**
   * Encodes the specified value, returning a buffer and flags that are
   * stored to the server and later used for decoding.
   *
   * @param value The value to encode.
   */
  encode(value: any): [Buffer, number]

  /**
   * Decodes a buffer and flags tuple back to the original type of the
   * document.
   *
   * @param bytes The bytes that were previously encoded.
   * @param flags The flags associated with the data.
   */
  decode(bytes: Buffer, flags: number): any
}

/**
 * The default transcoder implements cross-sdk transcoding capabilities by
 * taking advantage of the common flags specification to ensure compatibility.
 * This transcoder is capable of encoding/decoding any value which is encodable
 * to JSON, and additionally has special-case handling for Buffer objects.
 *
 * @category Key-Value
 */
export class DefaultTranscoder implements Transcoder {
  /**
   * Encodes the specified value, returning a buffer and flags that are
   * stored to the server and later used for decoding.
   *
   * @param value The value to encode.
   */
  encode(value: any): [Buffer, number] {
    // If its a buffer, write that directly as raw.
    if (Buffer.isBuffer(value)) {
      return [value, CF_RAW | NF_RAW]
    }

    // If its a string, encode it as a UTF8 string.
    if (typeof value === 'string') {
      return [Buffer.from(value), CF_UTF8 | NF_UTF8]
    }

    // Encode it to JSON and save that otherwise.
    return [Buffer.from(JSON.stringify(value)), CF_JSON | NF_JSON]
  }

  /**
   * Decodes a buffer and flags tuple back to the original type of the
   * document.
   *
   * @param bytes The bytes that were previously encoded.
   * @param flags The flags associated with the data.
   */
  decode(bytes: Buffer, flags: number): any {
    let format = flags & NF_MASK
    const cfformat = flags & CF_MASK

    if (cfformat !== CF_NONE) {
      if (cfformat === CF_JSON) {
        format = NF_JSON
      } else if (cfformat === CF_RAW) {
        format = NF_RAW
      } else if (cfformat === CF_UTF8) {
        format = NF_UTF8
      } else if (cfformat !== CF_PRIVATE) {
        // Unknown CF Format!  The following will force
        //   fallback to reporting RAW data.
        format = NF_UNKNOWN
      }
    }

    if (format === NF_UTF8) {
      return bytes.toString('utf8')
    } else if (format === NF_RAW) {
      return bytes
    } else if (format === NF_JSON) {
      try {
        return JSON.parse(bytes.toString('utf8'))
      } catch (e) {
        // If we encounter a parse error, assume that we need
        // to return bytes instead of an object.
        return bytes
      }
    }

    // Default to returning a Buffer if all else fails.
    return bytes
  }
}
