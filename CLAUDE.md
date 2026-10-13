# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Atom is a hackable text editor built on Electron (version pinned in `package.json` → `electronVersion`). The project was archived upstream on Dec 15, 2022. Full platform build prerequisites are in `docs/build-instructions/` and the Flight Manual's "Hacking on Atom Core" section.

## Commands

All tooling lives in `script/` (it has its own `package.json` / `node_modules`; use `.cmd` variants on Windows).

- `script/bootstrap` — install dependencies (root, `script/`, `apm/`, and bundled packages via apm). Pass `--ci` to use lockfiles strictly.
- `script/build` — transpile, generate the V8 startup snapshot, and package the app into `out/`. Useful flags: `--install`, `--existing-binaries` (skip clean/transpile/cache), `--compress-artifacts`, `--generate-api-docs`, `--code-sign`.
- `script/lint` — ESLint (standard + prettier, single quotes), CoffeeLint, and stylelint for Less.
- `script/clean` — wipe build outputs and caches.
- `script/test` — runs specs **against the built app in `out/`** (run `script/build` first). Flags: `--core-main`, `--core-renderer`, `--package`, `--core-benchmark`, `--skip-main`. Limit bundled-package specs with `ATOM_PACKAGES_TO_TEST=pkg1,pkg2`.

### Building on Apple Silicon

Builds natively for arm64 when run with an arm64 Node. Use **Node 16** (`node -p process.arch` must print `arm64`): newer Node breaks the pinned `nan`/node-gyp 5 toolchain, and Node 12/14 have no arm64 build. Mac-specific workarounds live in `script/lib/darwin-build-env.js` (compiler flags, `python` shim, `script/darwin-compat/include/iconv.h`), `script/lib/install-apm.js` (post-install patches to apm and its node-gyp so native modules target the host arch) and `script/lib/build-ctags-for-arm64.js`. Snapshot generation still runs Electron 11's x64 `mksnapshot` under Rosetta at build time only; the shipped app is native. The renderer specs `atom-environment-spec.js` and `config-spec.js` have 8 failures that predate the port (underscore 1.13's `debounce` ignores the `_.now` spy in `spec/spec-helper.coffee`).

### Running a single test

Specs run inside Atom itself, not plain Node. Use the built binary (or an installed `atom` pointed at this checkout):

```sh
# Renderer (Jasmine 1.3) spec file or directory
<atom-executable> --resource-path . --test spec/text-editor-spec.js

# Main-process (Mocha) specs
<atom-executable> --resource-path . --test --main-process spec/main-process

# A bundled package's specs
<atom-executable> --resource-path . --test packages/go-to-line/spec
```

On macOS the executable is `out/Atom*.app/Contents/MacOS/Atom*`. `script/test` prints the exact rerun command when a suite fails. Inside a running dev-mode Atom, "Window: Run Package Specs" also works. Focused specs: `fit`/`fdescribe`.

Set `ATOM_HOME` to a temp dir when running tests manually to avoid touching your real config (`script/test` does this).

## Architecture

### Two Electron processes

- **Main process** — `src/main-process/`. Entry: `package.json` `main` → `main.js` → `start.js`. `parse-command-line.js` handles CLI flags (`--test`, `--dev`, `--resource-path`, `--main-process`, `--benchmark-test`). `AtomApplication` owns windows (`AtomWindow`), menus, auto-update, file recovery, and IPC. Tests: `spec/main-process/*.test.js` (Mocha + chai).
- **Renderer process** — everything else in `src/`. Each window boots via `static/index.html`/`index.js` → `src/initialize-application-window.js` (or `initialize-test-window.js` / `initialize-benchmark-window.js`), which constructs an `AtomEnvironment` and exposes it as the global `atom`.

### AtomEnvironment (`src/atom-environment.js`)

Central object that wires together every manager/registry exposed as the public API: `atom.workspace`, `atom.config`, `atom.packages` (PackageManager), `atom.commands`, `atom.keymaps`, `atom.grammars`, `atom.themes`, `atom.project`, `atom.notifications`, `atom.tooltips`, `atom.views`, `atom.deserializers`, etc. `exports/atom.js` is what packages get from `require('atom')`. `application-delegate.js` is the renderer's IPC bridge to the main process.

### Workspace model

Workspace → `WorkspaceCenter` + three `Dock`s → `PaneContainer` → `PaneAxis` (splits) → `Pane` → items (usually `TextEditor`). Models and their DOM views are separate: `*-element.js` files are custom elements; `ViewRegistry` maps models to views. `text-editor-component.js` is the (etch-based) editor renderer; `TextEditor` wraps a `text-buffer` `TextBuffer` plus `DisplayLayer`.

### Language modes

Two grammar systems coexist, chosen by `GrammarRegistry`: legacy TextMate (`first-mate`, `text-mate-language-mode.js`) and Tree-sitter (`tree-sitter-grammar.js`, `tree-sitter-language-mode.js`, `syntax-scope-map.js`).

### Packages

Almost all user-visible features are packages. `package.json` `packageDependencies` lists bundled packages; those with `file:packages/...` live in `packages/` in this repo, the rest are pinned git refs to separate `atom/*` repos (see `packages/README.md`). Changes to a non-local bundled package must be made in its own repo and then the ref bumped here.

### Transpilation and startup snapshot

- Source is a mix of JS, CoffeeScript, and some Babel/TypeScript. At dev time, `compile-cache.js` transpiles on require (cached in `ATOM_HOME/compile-cache`); `script/build` precompiles for release.
- `script/lib/generate-startup-snapshot.js` uses `electron-link` to bundle `src/initialize-application-window.js` and its dependencies (including bundled packages, guarded by `global.isGeneratingSnapshot`) into a V8 snapshot. Code reachable at snapshot time must not touch DOM, Electron, or native modules at module-load time — defer such work to functions, or the build fails. `script/verify-snapshot-script` checks this. The `snapshotResult` global is available at runtime.

## Conventions

- Lint config: `.eslintrc.json` (standard + prettier, `singleQuote: true`), `coffeelint.json`, `stylelint.config.js`. Globals `atom` and `snapshotResult` are allowed; spec files additionally get `waitsForPromise`, `advanceClock`, etc.
- Renderer specs use Jasmine 1.3 helpers (`spec/spec-helper.coffee`, `spec/async-spec-helpers.js` provides `conditionPromise`, `emitterEventPromise`, `timeoutPromise` for async specs).
- Deprecations go through `grim` (`Grim.deprecate`), surfaced by the `deprecation-cop` package.
