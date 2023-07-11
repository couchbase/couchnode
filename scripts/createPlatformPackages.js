const fs = require('fs')
const path = require('path')
const { getSupportedPlatformPackages } = require('./prebuilds')

try {
  // we run this script w/in a Jenkins dir("couchnode"){} block
  const couchbasePkgData = JSON.parse(fs.readFileSync('package.json'))
  const packageName = couchbasePkgData.name
  const packageVersion = couchbasePkgData.version
  let platformPackages = (couchbasePkgData.optionalDependencies = {})
  const prebuildsPath = path.join(process.cwd(), 'prebuilds')
  const prebuilds = fs.readdirSync(prebuildsPath)
  const supportedPlatPkgs = getSupportedPlatformPackages(couchbasePkgData.name)
  for (const prebuild of prebuilds) {
    if (fs.lstatSync(path.join(prebuildsPath, prebuild)).isDirectory()) continue
    // prebuild format:
    //   couchbase-v<pkg-version>-<runtime>-v<runtime-version>-<platform>-<arch>-<SSL type>.node.tar.gz
    const tokens = prebuild.split('-')
    if (tokens.length < 7) continue
    if (tokens[tokens.length - 1].startsWith('debug')) {
      fs.renameSync(`prebuilds/${prebuild}`, `prebuilds_debug/${prebuild}`)
      continue
    }
    const nodeVersion = parseInt(
      tokens[tokens.length - 1].replace('.node', '').replace('node', '')
    )
    const arch = tokens[tokens.length - 2]
    const platform = tokens[tokens.length - 3]
    const runtime = tokens[tokens.length - 5]
    const sslType =
      runtime === 'napi'
        ? nodeVersion >= 18
          ? 'openssl3'
          : 'openssl1'
        : 'boringssl'
    const platPkg = `${tokens[0]}-${platform}-${arch}-${sslType}`
    let description = `Couchbase Node.js SDK platform specific binary for ${runtime} runtime on ${platform} OS with ${arch} architecture`
    if (runtime === 'napi') {
      description += ` and OpenSSL ${nodeVersion >= 18 ? '3.x' : '1.x'}.`
    } else {
      description += ' and BoringSSL.'
    }
    console.log(`platformPackage=${platPkg}`)
    if (supportedPlatPkgs.includes(platPkg)) {
      console.log(`Building requirements for platform package: ${platPkg}`)
      if (!fs.existsSync(`prebuilds/${platPkg}`)) {
        fs.mkdirSync(`prebuilds/${platPkg}`)
      }
      tokens[tokens.length - 1] = `${sslType}.node`
      const newPrebuildName = tokens.join('-')
      const oldPath = path.join('prebuilds', prebuild)
      const newPath = path.join('prebuilds', platPkg)
      fs.renameSync(oldPath, path.join(newPath, newPrebuildName))
      const platformPackage = `@${packageName}/${platPkg}`
      // build the platform package files: package.json, README and index.js
      const engines = { node: nodeVersion >= 18 ? '>=18' : '<18' }
      fs.writeFileSync(
        path.join(newPath, 'package.json'),
        JSON.stringify(
          {
            name: platformPackage,
            version: packageVersion,
            engines: engines,
            os: [platform.includes('linux') ? 'linux' : platform],
            cpu: [arch],
            bugs: couchbasePkgData.bugs,
            homepage: couchbasePkgData.homepage,
            license: couchbasePkgData.license,
            repository: couchbasePkgData.repository,
            description: description,
          },
          null,
          2
        )
      )
      fs.writeFileSync(path.join(newPath, 'index.js'), '')
      fs.writeFileSync(path.join(newPath, 'README.md'), description)
      platformPackages[platformPackage] = packageVersion
    }
  }

  if (
    !process.env.ALLOW_MISMATCH &&
    Object.keys(platformPackages).length != supportedPlatPkgs.length
  ) {
    const builtPlatformPkgs = Object.keys(platformPackages).map((pkg) => {
      const tokens = pkg.split('/')
      return tokens[1]
    })
    const missingPkgs = supportedPlatPkgs.filter(
      (pkg) => !builtPlatformPkgs.includes(pkg)
    )
    const extraPkgs = builtPlatformPkgs.filter(
      (pkg) => !supportedPlatPkgs.includes(pkg)
    )
    let msg = 'Mismatch in built platform packages.\n'
    msg += 'Missing: ' + JSON.stringify(missingPkgs) + '.\n'
    msg += 'Extra: ' + JSON.stringify(extraPkgs) + '.'
    throw new Error(msg)
  }
  fs.writeFileSync('package.json', JSON.stringify(couchbasePkgData, null, 2))
} catch (err) {
  console.log('An error occurred:', err)
  process.exitCode = 1
}
