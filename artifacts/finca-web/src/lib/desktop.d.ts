/**
 * Type declarations for the miFinca Desktop API exposed via Electron's contextBridge.
 * These are automatically available via the preload script when running inside the
 * desktop app. Always check `window.miFincaDesktop?.isDesktop` before using any API.
 */

export interface MiFincaDesktopAPI {
  readonly isDesktop: true;
  readonly version: string;

  activateLicense(
    key: string,
    authToken?: string
  ): Promise<{ ok: boolean; expiresAt?: string; error?: string }>;

  renewLicense(
    key: string
  ): Promise<{ ok: boolean; expiresAt?: string; error?: string }>;

  activationComplete(): void;
  renewalComplete(): void;

  clearLicense(): Promise<{ ok: boolean }>;
  openPurchase(): Promise<void>;
  installUpdate(): Promise<void>;

  onUpdateAvailable(
    cb: (info: { version: string; releaseNotes?: string }) => void
  ): void;

  onUpdateDownloaded(
    cb: (info: { version: string }) => void
  ): void;
}

declare global {
  interface Window {
    miFincaDesktop?: MiFincaDesktopAPI;
  }
}
