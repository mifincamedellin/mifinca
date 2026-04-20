import {
  app,
  BrowserWindow,
  ipcMain,
  net,
  session,
  safeStorage,
  nativeTheme,
  shell,
  type IpcMainInvokeEvent,
  type IncomingMessage,
} from "electron";
import { autoUpdater } from "electron-updater";
import path from "path";
import fs from "fs";
import { URL } from "url";

// ── Configuration ─────────────────────────────────────────────────────────────

/** Production API base. Set MIFINCA_API_URL at build time or via env. */
const API_BASE =
  process.env.MIFINCA_API_URL ?? "https://mifinca.replit.app";

const IS_DEV = process.env.MIFINCA_DEV === "1" || !app.isPackaged;
const USER_DATA_DIR = app.getPath("userData");
const LICENSE_FILE = path.join(USER_DATA_DIR, "license.dat");

// ── License storage ───────────────────────────────────────────────────────────

interface LicenseData {
  key: string;
  expiresAt: string;
  validatedAt: string;
}

// Security posture: license.dat is encrypted with safeStorage (OS keychain-backed)
// on all supported platforms where Electron ships with an OS credential store
// (macOS: Keychain, Windows: DPAPI, Linux: libsecret / kwallet).
// On headless/CI environments where safeStorage reports unavailable, the file
// falls back to plaintext JSON. This is acceptable for desktop packaging targets
// (Mac/Win) because safeStorage is always available there; the plaintext path is
// a dev/CI convenience fallback and is guarded by filesystem ACLs.
function readLicense(): LicenseData | null {
  try {
    if (!fs.existsSync(LICENSE_FILE)) return null;
    const raw = fs.readFileSync(LICENSE_FILE);
    if (safeStorage.isEncryptionAvailable()) {
      const json = safeStorage.decryptString(raw);
      return JSON.parse(json) as LicenseData;
    }
    return JSON.parse(raw.toString("utf-8")) as LicenseData;
  } catch {
    return null;
  }
}

function writeLicense(data: LicenseData): void {
  if (!fs.existsSync(USER_DATA_DIR)) fs.mkdirSync(USER_DATA_DIR, { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    const enc = safeStorage.encryptString(JSON.stringify(data));
    fs.writeFileSync(LICENSE_FILE, enc);
  } else {
    fs.writeFileSync(LICENSE_FILE, JSON.stringify(data), "utf-8");
  }
}

function clearLicense(): void {
  try { fs.unlinkSync(LICENSE_FILE); } catch { }
}

// ── API helpers ───────────────────────────────────────────────────────────────

interface ValidateResult {
  valid: boolean;
  expiresAt: string | null;
  reason?: string;
}

function apiRequest(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = net.request({ method: "GET", url });
    let body = "";
    req.on("response", (res) => {
      res.on("data", (chunk) => (body += chunk.toString()));
      res.on("end", () => resolve(body));
    });
    req.on("error", reject);
    req.end();
  });
}

async function validateKeyOnline(key: string): Promise<ValidateResult> {
  try {
    const url = `${API_BASE}/api/licenses/validate?key=${encodeURIComponent(key)}`;
    const timeoutMs = 7000;
    const body = await Promise.race([
      apiRequest(url),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);
    return JSON.parse(body) as ValidateResult;
  } catch {
    return { valid: false, expiresAt: null, reason: "offline" };
  }
}

/**
 * POST /api/licenses/activate  (optionally authenticated)
 *
 * No auth: activates an unclaimed key without user binding. Returns
 * { error: "login_required" } when the key is already bound to a user account —
 * the activation screen should then prompt the user to log in and retry with a JWT.
 *
 * With authToken: binds the key to the user's account. Idempotent for the same user.
 * Returns { error: "already_claimed" } only when a DIFFERENT user owns the key.
 */
async function activateKey(
  key: string,
  authToken?: string
): Promise<{ ok?: boolean; error?: string; expiresAt?: string }> {
  return new Promise((resolve) => {
    const req = net.request({
      method: "POST",
      url: `${API_BASE}/api/licenses/activate`,
    });
    req.setHeader("Content-Type", "application/json");
    if (authToken) {
      req.setHeader("Authorization", `Bearer ${authToken}`);
    }
    let body = "";
    req.on("response", (res: IncomingMessage) => {
      res.on("data", (chunk: Buffer) => (body += chunk.toString()));
      res.on("end", () => {
        try { resolve(JSON.parse(body)); }
        catch { resolve({ error: "parse_error" }); }
      });
    });
    req.on("error", () => resolve({ error: "network" }));
    req.write(JSON.stringify({ key }));
    req.end();
  });
}

// ── Window management ─────────────────────────────────────────────────────────

let mainWindow: BrowserWindow | null = null;
let activationWindow: BrowserWindow | null = null;
let renewalWindow: BrowserWindow | null = null;

function getWebDistPath(): string {
  if (IS_DEV) {
    return path.join(__dirname, "..", "web-dist");
  }
  return path.join(process.resourcesPath, "web-dist");
}

function getPreloadPath(): string {
  return path.join(__dirname, "preload.js");
}

function createActivationWindow(): void {
  activationWindow = new BrowserWindow({
    width: 480,
    height: 580,
    resizable: false,
    maximizable: false,
    center: true,
    title: "miFinca — Activar licencia",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a120b" : "#fdfaf7",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });
  activationWindow.loadFile(path.join(__dirname, "..", "src", "activation.html"));
  if (!IS_DEV) activationWindow.setMenu(null);
  activationWindow.once("ready-to-show", () => activationWindow?.show());
  activationWindow.on("closed", () => { activationWindow = null; });
}

function createRenewalWindow(): void {
  renewalWindow = new BrowserWindow({
    width: 480,
    height: 520,
    resizable: false,
    maximizable: false,
    center: true,
    title: "miFinca — Licencia vencida",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a120b" : "#fdfaf7",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });
  renewalWindow.loadFile(path.join(__dirname, "..", "src", "renewal.html"));
  if (!IS_DEV) renewalWindow.setMenu(null);
  renewalWindow.once("ready-to-show", () => renewalWindow?.show());
  renewalWindow.on("closed", () => { renewalWindow = null; });
}

function createMainWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: "miFinca",
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#1a120b" : "#fdfaf7",
    webPreferences: {
      preload: getPreloadPath(),
      contextIsolation: true,
      nodeIntegration: false,
    },
    show: false,
  });

  // In dev mode, load from the Vite dev server
  if (IS_DEV && process.env.MIFINCA_DEV_URL) {
    mainWindow.loadURL(process.env.MIFINCA_DEV_URL);
  } else {
    const indexPath = path.join(getWebDistPath(), "index.html");
    mainWindow.loadFile(indexPath);
  }

  if (!IS_DEV) mainWindow.setMenu(null);
  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
    // Trigger silent update check after main window is ready
    setupAutoUpdater();
  });
  mainWindow.on("closed", () => { mainWindow = null; });

  // Prevent navigation to external URLs — open in system browser instead
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (!url.startsWith("file://") && !url.startsWith(API_BASE)) {
      shell.openExternal(url);
    }
    return { action: "deny" };
  });
}

// ── Intercept API requests ────────────────────────────────────────────────────
// When the SPA is loaded from file://, relative /api/* calls fail.
// We intercept them and redirect to the production API server.

function setupApiInterceptor(): void {
  session.defaultSession.webRequest.onBeforeRequest(
    { urls: ["file://*api*", "file://*"] },
    (details, callback) => {
      const fileUrl = details.url;
      // Match paths that look like /api/...
      const apiMatch = fileUrl.match(/\/api\/(.*)/);
      if (apiMatch) {
        callback({ redirectURL: `${API_BASE}/api/${apiMatch[1]}` });
      } else {
        callback({});
      }
    }
  );

  // Inject ACAO: * for API responses received inside the Electron session.
  // Security note: this is intentionally broad because the renderer is a
  // trusted first-party shell loading from file:// — no untrusted origins
  // can issue cross-origin requests here. A follow-up can tighten this to
  // only allow the specific API_BASE origin if needed.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Access-Control-Allow-Origin": ["*"],
      },
    });
  });
}

// ── Auto-updater ──────────────────────────────────────────────────────────────

function setupAutoUpdater(): void {
  if (IS_DEV) return;

  const updateUrl = process.env.MIFINCA_UPDATE_URL;
  if (updateUrl) {
    autoUpdater.setFeedURL({ provider: "generic", url: updateUrl });
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("update-available", (info) => {
    mainWindow?.webContents.send("updater:update-available", {
      version: info.version,
      releaseNotes: info.releaseNotes,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    mainWindow?.webContents.send("updater:update-downloaded", {
      version: info.version,
    });
  });

  autoUpdater.on("error", (err) => {
    console.error("Auto-updater error:", err.message);
  });

  // Silently check in the background
  autoUpdater.checkForUpdatesAndNotify().catch(() => {});
}

// ── IPC handlers ──────────────────────────────────────────────────────────────

function setupIpc(): void {
  // Called by activation page. Calls POST /api/licenses/activate:
  //   - If authToken is provided (user already logged in): binds key to user account
  //   - If no authToken: activates unclaimed key without binding
  //   - If server returns login_required: bubbles up so UI can prompt login
  ipcMain.handle("license:activate", async (_event: IpcMainInvokeEvent, key: string, authToken: string) => {
    const normalizedKey = key.toUpperCase().trim();
    const activation = await activateKey(normalizedKey, authToken || undefined);
    if (!activation.ok || !activation.expiresAt) {
      return { ok: false, error: activation.error ?? "invalid" };
    }
    writeLicense({ key: normalizedKey, expiresAt: activation.expiresAt, validatedAt: new Date().toISOString() });
    return { ok: true, expiresAt: activation.expiresAt };
  });

  // Called by main window / renewal page: install update and restart
  ipcMain.handle("updater:install", async () => {
    autoUpdater.quitAndInstall(false, true);
  });

  // Called by renewal page: user entered a new key.
  ipcMain.handle("license:renew", async (_event: IpcMainInvokeEvent, key: string) => {
    const normalizedKey = key.toUpperCase().trim();
    const activation = await activateKey(normalizedKey);
    if (!activation.ok || !activation.expiresAt) {
      return { ok: false, error: activation.error ?? "invalid" };
    }
    writeLicense({ key: normalizedKey, expiresAt: activation.expiresAt, validatedAt: new Date().toISOString() });
    return { ok: true, expiresAt: activation.expiresAt };
  });

  // Clear stored license (used for testing / sign-out)
  ipcMain.handle("license:clear", async () => {
    clearLicense();
    return { ok: true };
  });

  // Open the miFinca website for purchasing / renewal
  ipcMain.handle("open:purchase", async () => {
    shell.openExternal(`${API_BASE}/app/login`);
  });
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

// Open the correct window based on current license state.
// This is safe to call more than once (e.g. on macOS "activate") because IPC
// handlers and interceptors are registered separately in bootstrap() below.
async function openAppropriateWindow(): Promise<void> {
  const license = readLicense();

  if (!license) {
    // First launch — show activation screen
    createActivationWindow();
    ipcMain.once("activation:complete", () => {
      activationWindow?.close();
      createMainWindow();
    });
    return;
  }

  // Key exists — validate it against the server
  const online = await validateKeyOnline(license.key);

  if (online.reason === "offline") {
    // Offline fallback: use cached expiry
    const expired = new Date(license.expiresAt) < new Date();
    if (expired) {
      createRenewalWindow();
      ipcMain.once("renewal:complete", () => {
        renewalWindow?.close();
        createMainWindow();
      });
    } else {
      createMainWindow();
    }
    return;
  }

  if (!online.valid) {
    // Key was revoked or truly expired — server confirmed
    if (online.expiresAt) {
      writeLicense({ ...license, expiresAt: online.expiresAt, validatedAt: new Date().toISOString() });
    }
    createRenewalWindow();
    ipcMain.once("renewal:complete", () => {
      renewalWindow?.close();
      createMainWindow();
    });
    return;
  }

  // Valid — refresh cached dates then open app
  writeLicense({
    key: license.key,
    expiresAt: online.expiresAt ?? license.expiresAt,
    validatedAt: new Date().toISOString(),
  });
  createMainWindow();
}

// One-time bootstrap: register IPC handlers and request interceptors exactly
// once (ipcMain.handle throws on duplicate registration), then open first window.
async function bootstrap(): Promise<void> {
  setupApiInterceptor();
  setupIpc();
  await openAppropriateWindow();
}

app.whenReady().then(bootstrap).catch(console.error);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// macOS: re-open when dock icon clicked with no windows open.
// Calls openAppropriateWindow() (not bootstrap) to avoid re-registering handlers.
app.on("activate", () => {
  if (!mainWindow && !activationWindow && !renewalWindow) {
    openAppropriateWindow().catch(console.error);
  }
});
