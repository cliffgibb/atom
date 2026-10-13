# Atom

[![Build status](https://dev.azure.com/github/Atom/_apis/build/status/Atom%20Production%20Branches?branchName=master)](https://dev.azure.com/github/Atom/_build/latest?definitionId=32&branchName=master)

> Atom and all repositories under Atom will be archived on December 15, 2022. Learn more in our [official announcement](https://github.blog/2022-06-08-sunsetting-atom/)

## About this fork: native Apple Silicon builds

This fork of the archived [atom/atom](https://github.com/atom/atom) builds Atom from source as a native arm64 app on Apple Silicon Macs (M1/M2/M3…), no Rosetta needed at runtime. Upstream only ever shipped x64 macOS builds. Nothing else about the editor has changed. There are no prebuilt releases; build it yourself as described below.

### Building on Apple Silicon

Requirements:

- Xcode Command Line Tools (`xcode-select --install`)
- **Node 16 for arm64** first on your `PATH` (`node -p process.arch` must print `arm64`). Newer Node versions can't compile the pinned native modules, and Node 12/14 have no arm64 build.
- Rosetta 2 (`softwareupdate --install-rosetta`), used at build time only. Electron 11's startup-snapshot generator ships only as an x64 binary.
- `curl` and network access to npm, GitHub, electronjs.org and SourceForge.

```sh
script/bootstrap
script/build            # produces out/Atom Dev.app
open "out/Atom Dev.app"
```

`script/build --install` builds and copies the app into `/Applications`. To get the `atom` and `apm` shell commands, choose **Atom Dev → Install Shell Commands** in the app. The app is unsigned, but macOS opens it without a warning on the Mac that built it.

### What changed from upstream

- **Host architecture instead of hard-coded x64:** the app is packaged for the build machine's architecture. The V8 startup snapshot is named per architecture (`v8_context_snapshot.arm64.bin`), and a failed snapshot step now stops the build.
- **Native modules compile for arm64:** after bootstrap installs apm and its node-gyp, `script/lib/install-apm.js` patches them to stop forcing x64. apm uses the Node that ran bootstrap, because its own Node 12 has no arm64 build.
- **Electron headers from a working mirror:** they now come from `artifacts.electronjs.org`, since atom.io no longer serves them.
- **Current macOS SDK compatibility:** `script/lib/darwin-build-env.js` supplies:
  - a `python` → `python3` shim;
  - C++17 and zlib `fdopen` flags;
  - an `iconv.h` shim (`script/darwin-compat/`) for superstring.
- **Updated tool dependencies:**
  - `electron-mksnapshot` goes to ^13, which still uses Electron 11.5.0's binary.
  - `vscode-ripgrep` goes to 1.13.2, which includes an arm64 `rg`.
- **ctags for symbols-view:** bootstrap builds an arm64 Exuberant Ctags 5.8 from checksummed source. It combines that with the vendored x86_64 binary into a universal binary.
- **Build steps that don't work on Apple Silicon are skipped:**
  - crash-report symbol dumping;
  - one test-only dev dependency that refuses to install on ARM.

Changes are in [`script/`](script) plus `package.json`, `package-lock.json` and [`CLAUDE.md`](CLAUDE.md). Intel Mac, Windows and Linux builds should behave as before.

### Known limitations

- `atom.io` services are gone, so auto-update, crash reporting and the package search inside the app don't work. Installing a package by git URL with `apm install <git-url>` still works.
- One small helper inside apm's bundled npm (`term-size`) is still x86_64. It's cosmetic.
- 8 renderer specs in `atom-environment-spec.js` and `config-spec.js` fail on upstream `master` too. All other core and tested bundled-package specs pass on an M2.

Atom is a hackable text editor for the 21st century, built on [Electron](https://github.com/electron/electron), and based on everything we love about our favorite editors. We designed it to be deeply customizable, but still approachable using the default configuration.

![Atom](https://user-images.githubusercontent.com/378023/49132477-f4b77680-f31f-11e8-8357-ac6491761c6c.png)

![Atom Screenshot](https://user-images.githubusercontent.com/378023/49132478-f4b77680-f31f-11e8-9e10-e8454d8d9b7e.png)

Visit [atom.io](https://atom.io) to learn more or visit the [Atom forum](https://github.com/atom/atom/discussions).

Follow [@AtomEditor](https://twitter.com/atomeditor) on Twitter for important
announcements.

This project adheres to the Contributor Covenant [code of conduct](CODE_OF_CONDUCT.md).
By participating, you are expected to uphold this code. Please report unacceptable behavior to atom@github.com.

## Documentation

If you want to read about using Atom or developing packages in Atom, the [Atom Flight Manual](https://flight-manual.atom.io) is free and available online. You can find the source to the manual in [atom/flight-manual.atom.io](https://github.com/atom/flight-manual.atom.io).

The [API reference](https://atom.io/docs/api) for developing packages is also documented on Atom.io.

## Installing

### Prerequisites
- [Git](https://git-scm.com)

### macOS

Download the latest [Atom release](https://github.com/atom/atom/releases/latest).

Atom will automatically update when a new release is available.

### Windows

Download the latest [Atom installer](https://github.com/atom/atom/releases/latest). `AtomSetup.exe` is 32-bit. For 64-bit systems, download `AtomSetup-x64.exe`.

Atom will automatically update when a new release is available.

You can also download `atom-windows.zip` (32-bit) or `atom-x64-windows.zip` (64-bit) from the [releases page](https://github.com/atom/atom/releases/latest).
The `.zip` version will not automatically update.

Using [Chocolatey](https://chocolatey.org)? Run `cinst Atom` to install the latest version of Atom.

### Linux

Atom is only available for 64-bit Linux systems.

Configure your distribution's package manager to install and update Atom by following the [Linux installation instructions](https://flight-manual.atom.io/getting-started/sections/installing-atom/#platform-linux) in the Flight Manual.  You will also find instructions on how to install Atom's official Linux packages without using a package repository, though you will not get automatic updates after installing Atom this way.

#### Archive extraction

An archive is available for people who don't want to install `atom` as root.

This version enables you to install multiple Atom versions in parallel. It has been built on Ubuntu 64-bit,
but should be compatible with other Linux distributions.

1. Install dependencies (on Ubuntu):
```sh
sudo apt install git libasound2 libcurl4 libgbm1 libgcrypt20 libgtk-3-0 libnotify4 libnss3 libglib2.0-bin xdg-utils libx11-xcb1 libxcb-dri3-0 libxss1 libxtst6 libxkbfile1
```
2. Download `atom-amd64.tar.gz` from the [Atom releases page](https://github.com/atom/atom/releases/latest).
3. Run `tar xf atom-amd64.tar.gz` in the directory where you want to extract the Atom folder.
4. Launch Atom using the installed `atom` command from the newly extracted directory.

The Linux version does not currently automatically update so you will need to
repeat these steps to upgrade to future releases.

## Building

* [Linux](https://flight-manual.atom.io/hacking-atom/sections/hacking-on-atom-core/#platform-linux)
* [macOS](https://flight-manual.atom.io/hacking-atom/sections/hacking-on-atom-core/#platform-mac)
* [Windows](https://flight-manual.atom.io/hacking-atom/sections/hacking-on-atom-core/#platform-windows)

## Discussion

* Discuss Atom on [GitHub Discussions](https://github.com/atom/atom/discussions)

## License

[MIT](https://github.com/atom/atom/blob/master/LICENSE.md)

When using the Atom or other GitHub logos, be sure to follow the [GitHub logo guidelines](https://github.com/logos).
