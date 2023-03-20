const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const stream = require('stream')
const { promisify } = require('util')
const pipe = promisify(stream.pipeline)

// Workaround to fix webpack's build warnings: 'the request of a dependency is an expression'
const runtimeRequire =
  typeof __webpack_require__ === 'function' ? __non_webpack_require__ : require

const openSSLVersions = ['openssl1', 'openssl3']
const supportedPlatforms = ['darwin', 'linux', 'linuxmusl', 'win32']
const supportedArches = ['x64', 'arm64']

const runtime = isElectron() ? 'electron' : 'node'
const nodeVersion = getNodeVersion()
const nodeVersionMajor = getNodeMajorVersion(nodeVersion)
const arch = process.arch
const platform = process.platform
const libc = getLinuxType(platform)
const sslType = getSSLType(runtime, nodeVersion)

function getLocalPrebuild(dir) {
  const localPrebuildDir = path.join(dir, 'build/Release')
  const files = readdirSync(localPrebuildDir).filter(matchBuild)
  return files[0] && path.join(localPrebuildDir, files[0])
}

function getLinuxType(platform) {
  if (platform !== 'linux') {
    return ''
  }
  return `linux${isAlpine(platform) ? 'musl' : ''}`
}

function getNodeMajorVersion(version) {
  const tokens = version.split('.')
  return parseInt(tokens[0])
}

function getNodeVersion() {
  return process.version.replace('v', '')
}

function getPrebuildsInfo(dir) {
  dir = path.resolve(dir || '.')
  const info = {
    packageDir: path.join(dir, 'package.json'),
    platformPackageDir: undefined,
  }

  const packageName = JSON.parse(fs.readFileSync(info.packageDir)).name
  if (packageName !== undefined) {
    const allowedPlatformPkg = `${packageName}-${
      platform === 'linux' ? libc : platform
    }-${arch}-${sslType}`
    const fullPlatformPkgName = `@${packageName}/${allowedPlatformPkg}`
    const packageRequire = require('module').createRequire(
      path.join(dir, 'package.json')
    )
    info.packageDir = path.dirname(path.join(dir, 'package.json'))
    info.platformPackageDir = path.dirname(
      packageRequire.resolve(fullPlatformPkgName)
    )
  }
  return info
}

function getSSLType(runtime, version) {
  if (runtime === 'electron') {
    return 'boringssl'
  }

  const major = getNodeMajorVersion(version)
  if (major >= 18) {
    return 'openssl3'
  }
  return 'openssl1'
}

function getSupportedPlatformPackages(packageName) {
  packageName = packageName || 'couchbase'
  if (packageName !== 'couchbase') {
    throw new Error(
      'Cannot build supported platform packages for package other than couchbase.'
    )
  }

  const packageNames = []
  // format: <platform>-<arch>-<runtime>-<SSL Type>
  supportedPlatforms.forEach((plat) => {
    supportedArches.forEach((arch) => {
      if (plat === 'win32' && arch === 'arm64') return
      openSSLVersions.forEach((ssl) => {
        packageNames.push(`${packageName}-${plat}-${arch}-${ssl}`)
      })
      packageNames.push(`${packageName}-${plat}-${arch}-boringssl`)
    })
  })
  return packageNames
}

function isAlpine(platform) {
  return platform === 'linux' && fs.existsSync('/etc/alpine-release')
}

function isElectron() {
  if (process.versions && process.versions.electron) return true
  if (process.env.ELECTRON_RUN_AS_NODE) return true
  return (
    typeof window !== 'undefined' &&
    window.process &&
    window.process.type === 'renderer'
  )
}

function loadPrebuild(dir) {
  return runtimeRequire(resolvePrebuild(dir))
}

function matchBuild(name) {
  return /\.node$/.test(name)
}

function matchingPlatformPrebuild(filename) {
  if (['index.js', 'package.json', 'README.md'].includes(filename)) {
    return false
  }
  const tokens = filename.split('-')
  // filename format:
  //   couchbase-v<pkg-version>-<runtime>-v<runtime-version>-<platform>-<arch>-<ssltype>.node
  if (tokens.length < 7) return false
  const prebuildSSL = tokens[tokens.length - 1].replace('.node', '')
  if (runtime === 'electron') {
    if (prebuildSSL !== 'boringssl') return false
  } else {
    if (nodeVersionMajor >= 18 && prebuildSSL !== 'openssl3') return false
    if (nodeVersionMajor < 18 && prebuildSSL !== 'openssl1') return false
  }
  if (tokens[tokens.length - 2] !== arch) return false
  const platCompare = platform === 'linux' ? libc : platform
  if (tokens[tokens.length - 3] !== platCompare) return false
  if (!matchBuild(filename)) return false
  // yay -- found a match!
  return true
}

function matchPrebuild(name) {
  return /\.tar\.gz$/.test(name) || matchBuild(name)
}

function readdirSync(dir) {
  try {
    return fs.readdirSync(dir)
  } catch (err) {
    return []
  }
}

async function resolveLocalPrebuild(src, dest) {
  if (fs.existsSync(src)) {
    const prebuilds = readdirSync(src).filter(matchPrebuild)
    if (prebuilds && prebuilds.length >= 1) {
      if (!fs.existsSync(dest)) {
        fs.mkdirSync(dest, { recursive: true })
      }
      const prebuild = prebuilds[0]
      let prebuildDestName = prebuild
      if (prebuild.endsWith('.tar.gz')) {
        const gzip = zlib.createGunzip()
        const source = fs.createReadStream(src)
        prebuildDestName = `${prebuild.substring(0, prebuild.length - 7)}.node`
        const destination = fs.createWriteStream(
          path.join(src, prebuildDestName)
        )
        await pipe(source, gzip, destination)
      }
      try {
        fs.copyFileSync(
          path.join(src, prebuild),
          path.join(dest, prebuildDestName)
        )
      } catch (_) {}
    }
  }
}

function resolvePrebuild(dir, runtimeResolve = true) {
  dir = path.resolve(dir || '.')
  try {
    const localPrebuild = getLocalPrebuild(dir)
    if (localPrebuild) {
      return localPrebuild
    }

    const packageName = runtimeResolve
      ? runtimeRequire(path.join(dir, 'package.json')).name
      : JSON.parse(fs.readFileSync(path.join(dir, 'package.json'))).name
    if (packageName !== undefined) {
      const supportedPackages = getSupportedPlatformPackages(packageName)
      const platformPkg = `${packageName}-${
        platform === 'linux' ? libc : platform
      }-${arch}-${sslType}`
      if (supportedPackages.includes(platformPkg)) {
        const fullPlatformPkgName = `@${packageName}/${platformPkg}`
        const packageRequire = require('module').createRequire(
          path.join(dir, 'package.json')
        )
        const platformPackagesDir = path.dirname(
          packageRequire.resolve(fullPlatformPkgName)
        )
        if (platformPackagesDir !== undefined) {
          const platformPrebuild = readdirSync(platformPackagesDir).filter(
            matchingPlatformPrebuild
          )
          if (platformPrebuild && platformPrebuild.length == 1) {
            return path.join(platformPackagesDir, platformPrebuild[0])
          }
        }
      }
    }
  } catch (_) {}

  let target = [
    `platform=${platform}`,
    `arch=${arch}`,
    `runtime=${runtime}`,
    `nodeVersion=${nodeVersion}`,
    `sslType=${sslType}`,
  ]
  if (libc) {
    target.push(`libc=${libc}`)
  }
  if (typeof __webpack_require__ === 'function') {
    target.push('webpack=true')
  }
  throw new Error(
    `Could not find native build for ${target.join(', ')} loaded from ${dir}.`
  )
}

module.exports = {
  getPrebuildsInfo,
  getSupportedPlatformPackages,
  loadPrebuild,
  resolveLocalPrebuild,
  resolvePrebuild,
}
