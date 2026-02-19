# Focus Timer

VS Code extension that tracks focused editor time per project.

## Opt-in

Tracking is off by default. To enable it for a project, create the timer file in the project root:

```sh
touch .focus-timer
```

Add it to `.gitignore` to keep it out of version control:

```sh
echo .focus-timer >> .gitignore
```

## How it works

While VS Code is focused, the extension accumulates time in memory. Minutes (rounded up) are appended to `.focus-timer` when the editor closes or every 100 minutes as a crash safety net.

The file is append-only, one number per line:

```
12
5
3
```

Total focused time = sum of all lines (in minutes).

## Reset

Delete or truncate the file:

```sh
rm .focus-timer     # opt out and clear
> .focus-timer      # clear but keep tracking
```

## Development

```bash
pnpm install
pnpm build        # compile to dist/
pnpm watch        # compile on change
pnpm lint         # eslint
pnpm check:full   # clean-room validation (deletes lockfile, node_modules, dist)
pnpm package      # install deps and compile to dist/
```

Press **F5** in VS Code to launch an Extension Development Host with the extension loaded.

## Install

The compiled extension is tracked in git, so no build step is needed.

```bash
ln -sfn "$PWD" "$HOME/.vscode/extensions/phroi.focus-timer-0.0.1"
```

Restart VS Code after creating the symlink.

### Devcontainer

To auto-install this extension in a devcontainer, clone and symlink it in `postCreateCommand`:

```jsonc
"postCreateCommand": {
  "focus-timer": "d=$HOME/focus-timer-ext && git clone --depth 1 https://github.com/phroi/vscode-focus-timer.git $d && ln -sfn $d \"$HOME/.vscode-server/extensions/phroi.focus-timer-0.0.1\""
}
```

## Licensing

Released under the [MIT License](./LICENSE).
