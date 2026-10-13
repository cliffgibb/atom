'use strict';

const CompileCache = require('../../src/compile-cache');
const fs = require('fs-extra');
const glob = require('glob');
const path = require('path');

const CONFIG = require('../config');
const backupNodeModules = require('./backup-node-modules');
const runApmInstall = require('./run-apm-install');

require('colors');

module.exports = function() {
  console.log(
    `Transpiling packages with custom transpiler configurations in ${
      CONFIG.intermediateAppPath
    }`
  );
  for (let packageName of Object.keys(CONFIG.appMetadata.packageDependencies)) {
    const rootPackagePath = path.join(
      CONFIG.repositoryRootPath,
      'node_modules',
      packageName
    );
    const intermediatePackagePath = path.join(
      CONFIG.intermediateAppPath,
      'node_modules',
      packageName
    );

    const metadataPath = path.join(intermediatePackagePath, 'package.json');
    const metadata = require(metadataPath);

    if (metadata.atomTranspilers) {
      console.log(' transpiling for package '.cyan + packageName.cyan);
      const rootPackageBackup = backupNodeModules(rootPackagePath);
      const intermediatePackageBackup = backupNodeModules(
        intermediatePackagePath
      );

      // Run `apm install` in the *root* package's path, so we get devDeps w/o apm's weird caching
      // Then copy this folder into the intermediate package's path so we can run the transpilation in-line.
      withoutArmIncompatibleDevDeps(rootPackagePath, () =>
        runApmInstall(rootPackagePath)
      );
      if (fs.existsSync(intermediatePackageBackup.nodeModulesPath)) {
        fs.removeSync(intermediatePackageBackup.nodeModulesPath);
      }
      fs.copySync(
        rootPackageBackup.nodeModulesPath,
        intermediatePackageBackup.nodeModulesPath
      );

      CompileCache.addTranspilerConfigForPath(
        intermediatePackagePath,
        metadata.name,
        metadata,
        metadata.atomTranspilers
      );
      for (let config of metadata.atomTranspilers) {
        const pathsToCompile = glob.sync(
          path.join(intermediatePackagePath, config.glob),
          { nodir: true }
        );
        pathsToCompile.forEach(transpilePath);
      }

      // Now that we've transpiled everything in-place, we no longer want Atom to try to transpile
      // the same files when they're being required.
      delete metadata.atomTranspilers;
      fs.writeFileSync(
        metadataPath,
        JSON.stringify(metadata, null, '  '),
        'utf8'
      );

      CompileCache.removeTranspilerConfigForPath(intermediatePackagePath);
      rootPackageBackup.restore();
      intermediatePackageBackup.restore();
    }
  }
};

// Dev dependencies whose install scripts refuse to run on ARM hosts. They are
// only used by the packages' own test suites, never for transpilation.
const ARM_INCOMPATIBLE_DEV_DEPS = ['electron-mksnapshot'];

function withoutArmIncompatibleDevDeps(packagePath, callback) {
  const metadataPath = path.join(packagePath, 'package.json');
  const lockPath = path.join(packagePath, 'package-lock.json');
  const metadata = fs.readJsonSync(metadataPath);
  const devDeps = metadata.devDependencies || {};
  const skipped = ARM_INCOMPATIBLE_DEV_DEPS.filter(name => devDeps[name]);
  if (!process.arch.startsWith('arm') || skipped.length === 0) {
    return callback();
  }

  const originalMetadata = fs.readFileSync(metadataPath);
  const originalLock = fs.existsSync(lockPath) && fs.readFileSync(lockPath);
  console.log(
    `  skipping ${skipped.join(', ')} (not installable on ${process.arch})`
  );
  for (const name of skipped) delete devDeps[name];
  fs.writeJsonSync(metadataPath, metadata, { spaces: 2 });
  try {
    return callback();
  } finally {
    fs.writeFileSync(metadataPath, originalMetadata);
    if (originalLock) fs.writeFileSync(lockPath, originalLock);
  }
}

function transpilePath(path) {
  fs.writeFileSync(
    path,
    CompileCache.addPathToCache(path, CONFIG.atomHomeDirPath)
  );
}
