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
const FLUSH_INTERVAL_MS = 100 * 60000;
let focusStart;
let pendingMs = 0;
let tick;
function timerPath() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    return folder ? path.join(folder.uri.fsPath, FILENAME) : undefined;
}
function appendTime(ms) {
    const minutes = Math.ceil(ms / 60000);
    if (minutes <= 0)
        return false;
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
function flush() {
    const now = Date.now();
    const elapsed = pendingMs + (focusStart !== undefined ? now - focusStart : 0);
    if (elapsed > 0 && appendTime(elapsed)) {
        pendingMs = 0;
        if (focusStart !== undefined)
            focusStart = now;
    }
}
function activate(context) {
    if (vscode.window.state.focused) {
        focusStart = Date.now();
    }
    context.subscriptions.push(vscode.window.onDidChangeWindowState((state) => {
        if (state.focused) {
            focusStart = Date.now();
        }
        else if (focusStart !== undefined) {
            pendingMs += Date.now() - focusStart;
            focusStart = undefined;
        }
    }));
    tick = setInterval(() => {
        flush();
    }, FLUSH_INTERVAL_MS);
}
function deactivate() {
    clearInterval(tick);
    flush();
}
