'use strict';

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const CONFIG = require('../config');

const apmPackagePath = path.join(
  CONFIG.apmRootPath,
  'node_modules',
  'atom-package-manager'
);

module.exports = function(ci) {
  if (ci) {
    // Tell apm not to dedupe its own dependencies during its
    // postinstall script. (Deduping during `npm ci` runs is broken.)
    process.env.NO_APM_DEDUPE = 'true';
  }
  console.log('Installing apm');
  childProcess.execFileSync(
    CONFIG.getLocalNpmBinPath(),
    ['--global-style', '--loglevel=error', ci ? 'ci' : 'install'],
    { env: process.env, cwd: CONFIG.apmRootPath }
  );

  if (process.platform === 'darwin') patchApmForAppleSilicon();
};

function patchApmForAppleSilicon() {
  // apm's postinstall downloads its own pinned Node, which has no darwin-arm64
  // build. When that download fails, fall back to the Node running this script:
  // apm's native dependencies were just compiled against it, so the ABI matches.
  const apmNodePath = path.join(apmPackagePath, 'bin', 'node');
  if (!fs.existsSync(apmNodePath)) {
    console.log(`Using ${process.execPath} (${process.version}) as apm's Node`);
    fs.copyFileSync(process.execPath, apmNodePath);
    fs.chmodSync(apmNodePath, 0o755);
  }

  // apm 2.6.2 hard-codes x64 as the Electron arch on macOS. Make it follow
  // ATOM_ARCH or the host arch like it does on other platforms.
  patchFile(
    path.join(apmPackagePath, 'lib', 'apm.js'),
    /case 'darwin':\s*return 'x64';\s*default:\s*return/,
    'default:\n          return',
    /getElectronArch: function\(\) \{\s*var ref;\s*switch \(process\.platform\) \{\s*default:/
  );

  // Electron 11's common.gypi only maps ia32/x64 to Xcode ARCHS, so for arm64
  // node-gyp 5's gyp falls back to its built-in x86_64 default. Default to the
  // host arch instead; x64 targets still get an explicit ARCHS from common.gypi.
  patchFile(
    path.join(
      apmPackagePath,
      'node_modules',
      'npm',
      'node_modules',
      'node-gyp',
      'gyp',
      'pylib',
      'gyp',
      'xcode_emulation.py'
    ),
    /'\$\(ARCHS_STANDARD\)',\n(\s*)XcodeArchsVariableMapping\(\['x86_64'\], \['x86_64'\]\),\n(\s*)XcodeArchsVariableMapping\(\['i386', 'x86_64'\]/,
    "'$(ARCHS_STANDARD)',\n$1XcodeArchsVariableMapping([os.uname()[4]], [os.uname()[4]]),\n$2XcodeArchsVariableMapping(['i386', 'x86_64']",
    /XcodeArchsVariableMapping\(\[os\.uname\(\)\[4\]\]/
  );
}

function patchFile(filePath, pattern, replacement, appliedPattern) {
  const original = fs.readFileSync(filePath, 'utf8');
  if (appliedPattern.test(original)) return;
  const patched = original.replace(pattern, replacement);
  if (patched === original) {
    throw new Error(`Could not apply Apple Silicon patch to ${filePath}`);
  }
  console.log(`Patching ${path.relative(CONFIG.repositoryRootPath, filePath)}`);
  fs.writeFileSync(filePath, patched);
}
