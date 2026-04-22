# laFinca Desktop

Electron desktop app for laFinca — offline-capable farm management for Colombian farms.

## Required environment variables

| Variable | When needed | Description |
|---|---|---|
| `LAFINCA_API_URL` | Build / runtime | Base URL of the laFinca API server. Default: `https://lafinca.app`. Set at build time via `electron-builder extraMetadata` or at runtime via env. |
| `LAFINCA_UPDATE_URL` | Production packaging | URL prefix where `latest-mac.yml` / `latest.yml` update manifests are hosted. Injected by the build script from the object-storage public path. |
| `DEFAULT_OBJECT_STORAGE_BUCKET_ID` | `pnpm build` | Object Storage bucket ID for uploading installers and update manifests. Required for the upload step in `scripts/build.mts`. |
| `LAFINCA_DEV` | Development | Set to `1` to run the app in dev mode (skips auto-updater, uses local web-dist). |

## Landing page download buttons

`artifacts/finca-landing` reads these Vite env vars to point download buttons at the correct installer URLs:

| Variable | Example value |
|---|---|
| `VITE_DESKTOP_DOWNLOAD_MAC` | `https://storage.googleapis.com/<bucket>/releases/latest/laFinca.dmg` |
| `VITE_DESKTOP_DOWNLOAD_WIN` | `https://storage.googleapis.com/<bucket>/releases/latest/laFinca-Setup.exe` |

When these are not set, the buttons show a "coming soon" state and open the purchase page instead.

## Building

```bash
# Compile TypeScript only
pnpm --filter @workspace/finca-desktop compile

# Full build + package + upload (requires BUCKET_ID and GCP credentials)
pnpm --filter @workspace/finca-desktop build
```

## Security notes

- **License storage**: `license.dat` in the Electron user-data directory is encrypted
  via `safeStorage` (macOS Keychain / Windows DPAPI) when available. Falls back to
  plaintext JSON on headless environments (e.g. CI). Packaged Mac/Win builds always
  have encryption available.

- **CORS interceptor**: The Electron session injects `Access-Control-Allow-Origin: *`
  for all responses. This is safe because the renderer loads from `file://` (a
  first-party shell with no untrusted origins). Can be tightened to allow only
  `LAFINCA_API_URL` in a future update.
