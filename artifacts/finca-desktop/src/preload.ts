import { contextBridge, ipcRenderer } from "electron";

// ── Exposed API surface ───────────────────────────────────────────────────────
// Only whitelisted channels are accessible from the renderer process.

contextBridge.exposeInMainWorld("miFincaDesktop", {
  /** Activate a license key (called from activation.html) */
  activateLicense: (key: string, authToken?: string) =>
    ipcRenderer.invoke("license:activate", key, authToken ?? ""),

  /** Renew with a new key (called from renewal.html) */
  renewLicense: (key: string) =>
    ipcRenderer.invoke("license:renew", key),

  /** Notify main process that activation succeeded — opens main window */
  activationComplete: () => ipcRenderer.send("activation:complete"),

  /** Notify main process that renewal succeeded — opens main window */
  renewalComplete: () => ipcRenderer.send("renewal:complete"),

  /** Clear the stored license (testing / reset) */
  clearLicense: () => ipcRenderer.invoke("license:clear"),

  /** Open purchase / renewal page in system browser */
  openPurchase: () => ipcRenderer.invoke("open:purchase"),

  /** Install a downloaded update and restart */
  installUpdate: () => ipcRenderer.invoke("updater:install"),

  /** Subscribe to update events (called from main window) */
  onUpdateAvailable: (
    cb: (info: { version: string; releaseNotes?: string }) => void
  ) => {
    ipcRenderer.on("updater:update-available", (_event, info) => cb(info));
  },
  onUpdateDownloaded: (cb: (info: { version: string }) => void) => {
    ipcRenderer.on("updater:update-downloaded", (_event, info) => cb(info));
  },

  /** Whether running inside the desktop app (used by the web app to adjust UI) */
  isDesktop: true as const,

  /** App version */
  version: process.env.npm_package_version ?? "1.0.0",
});
