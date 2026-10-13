'use strict';

// symbols-view vendors an x86_64-only Exuberant Ctags 5.8 binary. On Apple
// Silicon, build an arm64 slice from the same upstream source and combine it
// with the vendored x86_64 slice into a universal binary.

const childProcess = require('child_process');
const crypto = require('crypto');
const fs = require('fs-extra');
const os = require('os');
const path = require('path');

const CONFIG = require('../config');

const CTAGS_URL =
  'https://downloads.sourceforge.net/project/ctags/ctags/5.8/ctags-5.8.tar.gz';
const CTAGS_SHA256 =
  '0e44b45dcabe969e0bbbb11e30c246f81abe5d32012db37395eb57d66e9e99c7';

module.exports = function() {
  if (process.platform !== 'darwin' || process.arch !== 'arm64') return;

  const ctagsPath = path.join(
    CONFIG.repositoryRootPath,
    'node_modules',
    'symbols-view',
    'vendor',
    'ctags-darwin'
  );
  if (!fs.existsSync(ctagsPath) || getArchs(ctagsPath).includes('arm64')) {
    return;
  }

  console.log('Building arm64 ctags for symbols-view');
  const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'atom-ctags-'));
  try {
    const tarballPath = path.join(workDir, 'ctags-5.8.tar.gz');
    run('curl', ['-sSfL', '-o', tarballPath, CTAGS_URL]);
    const sha256 = crypto
      .createHash('sha256')
      .update(fs.readFileSync(tarballPath))
      .digest('hex');
    if (sha256 !== CTAGS_SHA256) {
      throw new Error(`ctags-5.8.tar.gz checksum mismatch: ${sha256}`);
    }
    run('tar', ['xzf', tarballPath, '-C', workDir]);

    const sourceDir = path.join(workDir, 'ctags-5.8');
    // ctags defines its own `__unused__` macro, which breaks the
    // `__attribute__((__unused__))` used by current SDK headers.
    for (const file of fs.readdirSync(sourceDir)) {
      if (!/\.[ch]$/.test(file)) continue;
      const filePath = path.join(sourceDir, file);
      const source = fs.readFileSync(filePath, 'latin1');
      fs.writeFileSync(
        filePath,
        source.replace(/__unused__/g, 'CTAGS_ATTR_UNUSED'),
        'latin1'
      );
    }

    // ctags 5.8's JavaScript parser reports the wrong line numbers when
    // optimized by current clang, so build it unoptimized; at -O0 its output
    // matches the vendored x86_64 binary exactly. The -Wno flags keep
    // configure's feature probes (e.g. regcomp) from failing on modern clang.
    const env = Object.assign({}, process.env, {
      CFLAGS: [
        '-O0',
        '-arch arm64',
        '-mmacosx-version-min=11.0',
        '-w',
        '-Wno-implicit-function-declaration',
        '-Wno-implicit-int'
      ].join(' ')
    });
    run('./configure', ['--disable-etags'], { cwd: sourceDir, env });
    run('make', ['-j4'], { cwd: sourceDir, env });

    const universalPath = path.join(workDir, 'ctags-darwin');
    run('lipo', [
      '-create',
      ctagsPath,
      path.join(sourceDir, 'ctags'),
      '-output',
      universalPath
    ]);
    fs.copyFileSync(universalPath, ctagsPath);
    fs.chmodSync(ctagsPath, 0o755);
  } finally {
    fs.removeSync(workDir);
  }
};

function getArchs(binaryPath) {
  return childProcess
    .execFileSync('lipo', ['-archs', binaryPath], { encoding: 'utf8' })
    .trim()
    .split(' ');
}

function run(command, args, options) {
  childProcess.execFileSync(
    command,
    args,
    Object.assign({ stdio: ['ignore', 'ignore', 'inherit'] }, options)
  );
}
