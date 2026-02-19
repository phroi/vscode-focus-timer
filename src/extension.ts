import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const FILENAME = ".focus-timer";
const FLUSH_INTERVAL_MS = 100 * 60_000;

let focusStart: number | undefined;
let pendingMs = 0;
let tick: ReturnType<typeof setInterval>;

function timerPath(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? path.join(folder.uri.fsPath, FILENAME) : undefined;
}

function appendTime(ms: number): boolean {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes <= 0) return false;
  const file = timerPath();
  if (!file || !fs.existsSync(file)) return false;
  try {
    fs.appendFileSync(file, `${String(minutes)}\n`);
    return true;
  } catch {
    return false;
  }
}

function flush(): void {
  const now = Date.now();
  const elapsed = pendingMs + (focusStart !== undefined ? now - focusStart : 0);
  if (elapsed > 0 && appendTime(elapsed)) {
    pendingMs = 0;
    if (focusStart !== undefined) focusStart = now;
  }
}

export function activate(context: vscode.ExtensionContext): void {
  if (vscode.window.state.focused) {
    focusStart = Date.now();
  }

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) {
        focusStart = Date.now();
      } else if (focusStart !== undefined) {
        pendingMs += Date.now() - focusStart;
        focusStart = undefined;
      }
    }),
  );

  tick = setInterval(() => {
    flush();
  }, FLUSH_INTERVAL_MS);

}

export function deactivate(): void {
  clearInterval(tick);
  flush();
}
