#!/usr/bin/env node

const path = require('path')
var proc = require('child_process')
const prebuilds = require('./prebuilds')

if (hasLocalPrebuild()) {
  const destination = path.join(
    path.resolve(__dirname, '..'),
    'build',
    'Release'
  )
  const source = getLocalPrebuild()
  // on either success or failure of resolving local prebuild we still confirm we have a prebuild
  prebuilds.resolveLocalPrebuild(source, destination).then(installPrebuild())
} else {
  installPrebuild()
}

function getLocalPrebuild() {
  const localPrebuildsName = `npm_config_couchbase_local_prebuilds`
  return process.env[localPrebuildsName]
}

function hasLocalPrebuild() {
  return typeof getLocalPrebuild() === 'string'
}

function installPrebuild() {
  try {
    prebuilds.resolvePrebuild(path.resolve(__dirname, '..'), false)
    process.exit(0)
  } catch (err) {
    const cmakejs = path.join(
      require.resolve('cmake-js/package.json'),
      '..',
      require('cmake-js/package.json').bin['cmake-js']
    )
    // @TODO: is spawning sync a problem? Seemed to be easiest way to get Ctrl-C to kill the whole build process
    const cmakejsProc = proc.spawnSync(process.execPath, [cmakejs, 'compile'], {
      stdio: 'inherit',
    })
    process.exit(cmakejsProc.status)
  }
}
