/**
 * Type declaration for the laFincaDesktop API exposed via the preload script.
 * Copy this file (or import it) into finca-web to get typed access to the
 * desktop-only APIs when the app is running inside Electron.
 *
 * Usage in finca-web:
 *   const isDesktop = !!(window as any).laFincaDesktop?.isDesktop;
 */

export interface LaFincaDesktopAPI {
  /** true when running inside the Electron desktop app */
  isDesktop: true;
  /** App version string */
  version: string;

  /** Activate a license key on first launch */
  activateLicense(
    key: string,
    authToken?: string
  ): Promise<{ ok: boolean; expiresAt?: string; error?: string }>;

  /** Renew with a new key (shown when current license has expired) */
  renewLicense(
    key: string
  ): Promise<{ ok: boolean; expiresAt?: string; error?: string }>;

  /** Signal that activation succeeded — triggers main window to open */
  activationComplete(): void;

  /** Signal that renewal succeeded — triggers main window to open */
  renewalComplete(): void;

  /** Erase the stored license (for testing / account sign-out) */
  clearLicense(): Promise<{ ok: boolean }>;

  /** Open the purchase / renewal page in the system browser */
  openPurchase(): Promise<void>;

  /** Trigger install of a downloaded update and restart the app */
  installUpdate(): Promise<void>;

  /** Register a callback for when a new update is available for download */
  onUpdateAvailable(
    cb: (info: { version: string; releaseNotes?: string }) => void
  ): void;

  /** Register a callback for when an update has finished downloading */
  onUpdateDownloaded(cb: (info: { version: string }) => void) : void;
}

declare global {
  interface Window {
    laFincaDesktop?: LaFincaDesktopAPI;
  }
}
