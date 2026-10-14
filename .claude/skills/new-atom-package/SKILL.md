---
name: new-atom-package
description: Scaffold, link and test a new user Atom package from a plain-language description of what it should do. Use when the user asks to create, make, write or add an Atom package, plugin or extension, or a new command under the Packages menu.
---

# New Atom package

Turn the user's description into a working, tested Atom package that shows up under the **Packages** menu. Every new package is a standalone git repo **outside** this Atom checkout, symlinked into `~/.atom/packages`, so it loads without rebuilding Atom.

Leave the core repo untouched: no edits to `packages/`, root `package.json`, `package-lock.json` or `packages/README.md`.

## 1. Pin down the spec

Settle these before writing code. Ask only about what the description leaves genuinely ambiguous; take sensible defaults for the rest and state them in the final report.

- **Behaviour**: what each command does, and to what: whole buffer vs. selections, current editor vs. workspace, edge cases (empty buffer, CRLF, multiple cursors).
- **Name**: kebab-case, e.g. `sort-lines-unique`. Command names are `<name>:<verb>`.
- **Location**: the parent directory for the package. Default `../atom-packages` relative to this repo root (i.e. `~/Dev/atom-packages`); use whatever the user names instead. Create it if missing.
- **Entry points**: always a _Packages > Title Case Name_ menu item per command. Add context-menu entries, keybindings, settings (`configSchema`) or a stylesheet only when the behaviour calls for them.

Done when: `<location>/<name>` and `~/.atom/packages/<name>` both don't exist and no bundled package in `packages/` or root `package.json` `packageDependencies` has that name. On a clash, pick another name with the user.

## 2. Scaffold

Create `<location>/<name>/` with:

```
package.json
lib/main.js
menus/<name>.cson
spec/<name>-spec.js
README.md
LICENSE.md        # MIT, copyright <current year> Cliff Fenwick Gibb
.gitignore        # node_modules/ and .DS_Store
keymaps/<name>.cson, styles/<name>.less   # only if needed
```

`package.json` — activate lazily via `activationCommands` listing every command:

```json
{
  "name": "<name>",
  "main": "./lib/main",
  "version": "0.1.0",
  "description": "<one sentence>",
  "keywords": [],
  "license": "MIT",
  "engines": { "atom": ">=1.0.0 <2.0.0" },
  "activationCommands": {
    "atom-text-editor:not([mini])": ["<name>:<verb>"]
  },
  "dependencies": {}
}
```

Use `"atom-workspace"` as the selector for commands that don't need an editor.

`lib/main.js` — register commands in `activate()` into a `CompositeDisposable` and dispose it in `deactivate()`. Wrap buffer edits in `editor.transact()` so one command is one undo step. Code style: single quotes, semicolons, 2-space indent, a short comment above each non-obvious function.

`menus/<name>.cson`:

```cson
'menu': [
  'label': 'Packages'
  'submenu': [
    'label': '<Title Case Name>'
    'submenu': [
      'label': '<Command label>'
      'command': '<name>:<verb>'
    ]
  ]
]
```

`spec/<name>-spec.js` — Jasmine 1.3 (`describe`/`it`/`waitsForPromise`). In `beforeEach`, open an editor with `waitsForPromise(() => atom.workspace.open().then(e => { editor = e; }))`, then call `atom.packages.activatePackage(path.join(__dirname, '..'))` **without waiting on it**: with `activationCommands` that promise resolves only after a command fires, so `waitsForPromise` on it times out every spec. Trigger behaviour through `atom.commands.dispatch(atom.views.getView(editor), '<name>:<verb>')`, the same path the menu uses; the first dispatch activates the package synchronously and runs the real handler. Cover every command, every branch from step 1, and undo as a single step for edits.

`README.md` — what each command does, its edge-case behaviour, and where to run it from (command palette, _Packages > …_ menu, any context menu or keybinding).

## 3. Test

Run the specs with the Atom built from this repo and a throwaway `ATOM_HOME`:

```sh
ATOM_HOME="$(mktemp -d)" "out/Atom Dev.app/Contents/MacOS/Atom Dev" \
  --resource-path "$PWD" --test <location>/<name>/spec
```

(Run from the repo root. If `out/` holds no `.app`, ask the user before running `script/build`; it is slow.)

Done when: the suite is green with zero failures. Fix the package code, not the expectations, unless the expectation contradicts the agreed spec.

## 4. Commit and link

```sh
cd <location>/<name>
git init && git add -A && git commit -m "Add <name> package"
<atom-repo>/apm/node_modules/.bin/apm link
```

`apm` isn't on `PATH`; call it by absolute path inside this repo. If it fails, fall back to `ln -s <location>/<name> ~/.atom/packages/<name>`.

Done when: `~/.atom/packages/<name>` is a symlink resolving to `<location>/<name>`, and the package repo has a clean `git status`.

## 5. Report

Tell the user: package path, the commands and where each appears, defaults you chose in step 1, the spec result, and that a running Atom needs **Window: Reload** (`ctrl-alt-cmd-l`) to pick up the package.
