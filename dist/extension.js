"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const vscode = __importStar(require("vscode"));
const FILENAME = ".focus-timer";
const FLUSH_THRESHOLD_MS = 10 * 60000;
const HEARTBEAT_MS = 30000;
const GRACE_MS = 5 * 60000;
let focusStart;
let pendingMs = 0;
let lastBlurAt = 0;
let overshootMs = 0;
function timerPath() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder ? path.join(folder.uri.fsPath, FILENAME) : undefined;
}
function appendTime(ms) {
    const minutes = Math.ceil(ms / 60000);
    const file = timerPath();
    if (!file || !fs.existsSync(file))
        return false;
    try {
        fs.appendFileSync(file, `${String(minutes)}\n`);
        return true;
    }
    catch {
        return false;
    }
}
function flush(thresholdMs = 0) {
    const now = Date.now();
    const raw = pendingMs + (focusStart !== undefined ? now - focusStart : 0);
    const elapsed = Math.max(0, raw - overshootMs);
    if (elapsed >= thresholdMs && elapsed > 0 && appendTime(elapsed)) {
        const writtenMs = Math.ceil(elapsed / 60000) * 60000;
        overshootMs = writtenMs - elapsed;
        pendingMs = 0;
        if (focusStart !== undefined)
            focusStart = now;
    }
}
function onBlur() {
    if (focusStart === undefined)
        return;
    const now = Date.now();
    pendingMs += now - focusStart;
    focusStart = undefined;
    lastBlurAt = now;
}
function onFocus() {
    const now = Date.now();
    // Save any already-tracked time before resetting (handles duplicate focus events)
    if (focusStart !== undefined) {
        pendingMs += now - focusStart;
    }
    // If returning within grace period, backdate focusStart to cover the gap
    const withinGrace = now - lastBlurAt <= GRACE_MS;
    focusStart = withinGrace ? lastBlurAt : now;
    if (withinGrace)
        lastBlurAt = 0;
}
function activate(context) {
    focusStart = undefined;
    pendingMs = 0;
    lastBlurAt = 0;
    overshootMs = 0;
    if (vscode.window.state.focused) {
        focusStart = Date.now();
    }
    context.subscriptions.push(vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
            onFocus();
        }
        else {
            onBlur();
        }
    }));
    // Heartbeat: poll vscode.window.state.focused to catch missed
    // onDidChangeWindowState events (known VS Code bug with webviews/terminals),
    // and flush when accumulated time crosses the threshold
    const heartbeat = setInterval(() => {
        const isFocused = vscode.window.state.focused;
        if (isFocused && focusStart === undefined) {
            onFocus();
        }
        else if (!isFocused && focusStart !== undefined) {
            onBlur();
        }
        flush(FLUSH_THRESHOLD_MS);
    }, HEARTBEAT_MS);
    context.subscriptions.push({
        dispose() {
            clearInterval(heartbeat);
        },
    });
}
function deactivate() {
    flush();
}
