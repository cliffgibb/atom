'use strict';

// Environment tweaks that let Atom's pinned native dependencies compile with
// current macOS toolchains (Apple Silicon and recent SDKs). Child processes
// spawned by bootstrap (npm, apm, node-gyp) inherit these via process.env.

const childProcess = require('child_process');
const path = require('path');

const CONFIG = require('../config');

const compatPath = path.join(CONFIG.scriptRootPath, 'darwin-compat');

function appendFlags(name, flags) {
  const existing = process.env[name] ? process.env[name].split(' ') : [];
  const missing = flags.filter(flag => !existing.includes(flag));
  process.env[name] = existing.concat(missing).join(' ');
}

function hasPython() {
  try {
    childProcess.execFileSync('python', ['--version'], { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

module.exports = function() {
  if (process.platform !== 'darwin') return;

  // gyp-mac-tool (node-gyp 5) runs `python`, which macOS no longer ships.
  if (!hasPython()) {
    process.env.PATH = `${path.join(compatPath, 'bin')}:${process.env.PATH}`;
  }

  // Old bundled zlib (libgit2 in git-utils) redefines fdopen() as NULL when
  // TARGET_OS_MAC is set, which newer SDK headers then fail to parse. Its
  // `#ifndef fdopen` guard lets a self-referential define skip that.
  appendFlags('CFLAGS', ['-Dfdopen=fdopen']);

  // Node 16+ and Electron headers need C++14 or later, but some old
  // binding.gyp files force an older standard; the last -std wins. The
  // include dir provides an iconv.h shim for superstring (see that file).
  appendFlags('CXXFLAGS', [
    '-std=c++17',
    `-I${path.join(compatPath, 'include')}`
  ]);
};
