import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const FILENAME = ".focus-timer";
const FLUSH_THRESHOLD_MS = 10 * 60_000;
const HEARTBEAT_MS = 30_000;
const GRACE_MS = 5 * 60_000;

let focusStart: number | undefined;
let pendingMs = 0;
let lastBlurAt = 0;
let overshootMs = 0;

function timerPath(): string | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  return folder ? path.join(folder.uri.fsPath, FILENAME) : undefined;
}

function appendTime(ms: number): boolean {
  const minutes = Math.ceil(ms / 60_000);
  const file = timerPath();
  if (!file || !fs.existsSync(file)) return false;
  try {
    fs.appendFileSync(file, `${String(minutes)}\n`);
    return true;
  } catch {
    return false;
  }
}

function flush(thresholdMs = 0): void {
  const now = Date.now();
  const raw = pendingMs + (focusStart !== undefined ? now - focusStart : 0);
  const elapsed = Math.max(0, raw - overshootMs);
  if (elapsed >= thresholdMs && elapsed > 0 && appendTime(elapsed)) {
    const writtenMs = Math.ceil(elapsed / 60_000) * 60_000;
    overshootMs = writtenMs - elapsed;
    pendingMs = 0;
    if (focusStart !== undefined) focusStart = now;
  }
}

function onBlur(): void {
  if (focusStart === undefined) return;
  const now = Date.now();
  pendingMs += now - focusStart;
  focusStart = undefined;
  lastBlurAt = now;
}

function onFocus(): void {
  const now = Date.now();
  // Save any already-tracked time before resetting (handles duplicate focus events)
  if (focusStart !== undefined) {
    pendingMs += now - focusStart;
  }
  // If returning within grace period, backdate focusStart to cover the gap
  const withinGrace = now - lastBlurAt <= GRACE_MS;
  focusStart = withinGrace ? lastBlurAt : now;
  if (withinGrace) lastBlurAt = 0;
}

export function activate(context: vscode.ExtensionContext): void {
  focusStart = undefined;
  pendingMs = 0;
  lastBlurAt = 0;
  overshootMs = 0;

  if (vscode.window.state.focused) {
    focusStart = Date.now();
  }

  context.subscriptions.push(
    vscode.window.onDidChangeWindowState((state) => {
      if (state.focused) {
        onFocus();
      } else {
        onBlur();
      }
    }),
  );

  // Heartbeat: poll vscode.window.state.focused to catch missed
  // onDidChangeWindowState events (known VS Code bug with webviews/terminals),
  // and flush when accumulated time crosses the threshold
  const heartbeat = setInterval(() => {
    const isFocused = vscode.window.state.focused;
    if (isFocused && focusStart === undefined) {
      onFocus();
    } else if (!isFocused && focusStart !== undefined) {
      onBlur();
    }
    flush(FLUSH_THRESHOLD_MS);
  }, HEARTBEAT_MS);
  context.subscriptions.push({
    dispose(): void {
      clearInterval(heartbeat);
    },
  });
}

export function deactivate(): void {
  flush();
}
