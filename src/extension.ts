import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

const FILENAME = ".focus-timer";
const FLUSH_THRESHOLD_MS = 9 * 60_000;
const HEARTBEAT_MS = 30_000;
const GRACE_MS = 10 * 60_000;

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
  if (elapsed > thresholdMs && elapsed > 0 && appendTime(elapsed)) {
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
  // Linear-decay grace: short absences get nearly full credit, longer ones
  // progressively less. credit = awayMs × (1 − awayMs / GRACE_MS), which
  // smoothly reaches zero at GRACE_MS (no cliff edge).
  const awayMs = now - lastBlurAt;
  if (lastBlurAt > 0 && awayMs > 0 && awayMs <= GRACE_MS) {
    const credit = awayMs * (1 - awayMs / GRACE_MS);
    focusStart = now - credit;
  } else {
    focusStart = now;
  }
  lastBlurAt = 0;
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
  // detect system sleep/hibernate, and flush when accumulated time crosses
  // the threshold
  let lastHeartbeat = Date.now();
  const heartbeat = setInterval(() => {
    const now = Date.now();
    const gap = now - lastHeartbeat;

    // Detect sleep/hibernate: if the gap between heartbeats greatly exceeds
    // the polling interval, the machine was likely suspended. Credit focus
    // time up to the last heartbeat (best estimate of when sleep began) and
    // start fresh so the sleep interval isn't counted.
    if (gap > HEARTBEAT_MS * 3) {
      if (focusStart !== undefined) {
        pendingMs += Math.max(0, lastHeartbeat - focusStart);
        focusStart = now;
      }
      lastBlurAt = 0; // don't grant grace across a sleep boundary
    }

    lastHeartbeat = now;

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
