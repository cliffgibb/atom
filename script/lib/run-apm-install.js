'use strict';

const childProcess = require('child_process');

const CONFIG = require('../config');

module.exports = function(packagePath, ci, stdioOptions) {
  const installEnv = Object.assign({}, process.env);
  // Set resource path so that apm can load metadata related to Atom.
  installEnv.ATOM_RESOURCE_PATH = CONFIG.repositoryRootPath;
  // apm's default header URL (atom.io/download/electron) went away with the
  // atom.io shutdown; point node-gyp at Electron's own header mirror instead.
  if (!installEnv.ATOM_ELECTRON_URL) {
    installEnv.ATOM_ELECTRON_URL =
      'https://artifacts.electronjs.org/headers/dist';
  }

  childProcess.execFileSync(CONFIG.getApmBinPath(), [ci ? 'ci' : 'install'], {
    env: installEnv,
    cwd: packagePath,
    stdio: stdioOptions || 'inherit'
  });
};
