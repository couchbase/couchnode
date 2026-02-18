/**
 * @internal
 */
export function generateClientString(): string {
  // Grab the various versions.  Note that we need to trim them
  // off as some Node.js versions insert strange characters into
  // the version identifiers (mainly newlines and such).

  const nodeVer = process.versions.node.trim()
  const v8Ver = process.versions.v8.trim()
  const sslVer = process.versions.openssl.trim()

  return `node/${nodeVer}; v8/${v8Ver}; ssl/${sslVer}`
}
