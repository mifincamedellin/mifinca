#!/usr/bin/env tsx
/**
 * laFinca Desktop Build Script
 *
 * Usage (run from repo root):
 *   LAFINCA_API_URL=https://your-api.replit.app \
 *   LAFINCA_UPDATE_URL=https://storage.googleapis.com/your-bucket/desktop/updates \
 *   pnpm --filter @workspace/finca-desktop build
 *
 * Prerequisites:
 *   - Mac: Xcode CLI tools  (for .dmg)
 *   - Windows: NSIS         (for .exe installer)
 *   - GCS credentials set via GOOGLE_APPLICATION_CREDENTIALS or Replit sidecar
 *
 * What this script does:
 *   1. Compiles the Electron TypeScript source (main + preload)
 *   2. Builds finca-web with BASE_PATH=/ for Electron
 *   3. Runs electron-builder to produce platform installers
 *   4. Uploads the installers + update manifests to object storage
 */

import { execSync, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..", "..");
const DESKTOP_DIR = path.resolve(__dirname, "..");
const WEB_DIR = path.resolve(ROOT, "artifacts", "finca-web");
const WEB_DIST = path.resolve(WEB_DIR, "dist", "public");
const DESKTOP_WEB_DIST = path.resolve(DESKTOP_DIR, "web-dist");
const RELEASE_DIR = path.resolve(DESKTOP_DIR, "release");

const API_URL = process.env.LAFINCA_API_URL;
const UPDATE_URL = process.env.LAFINCA_UPDATE_URL;
const BUCKET_ID = process.env.DEFAULT_OBJECT_STORAGE_BUCKET_ID;

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(cmd: string, cwd = ROOT, env: Record<string, string> = {}): void {
  console.log(`\n▸ ${cmd}`);
  execSync(cmd, {
    cwd,
    stdio: "inherit",
    env: { ...process.env, ...env },
  });
}

function step(msg: string): void {
  console.log(`\n${"─".repeat(60)}\n  ${msg}\n${"─".repeat(60)}`);
}

// ── Step 1: Compile Electron TypeScript ──────────────────────────────────────

step("1/4  Compiling Electron main process");
run("pnpm --filter @workspace/finca-desktop compile");

// ── Step 2: Build finca-web for Electron ─────────────────────────────────────

step("2/4  Building finca-web (BASE_PATH=/, port=3000)");
run(
  "pnpm --filter @workspace/finca-web build",
  ROOT,
  {
    BASE_PATH: "/",
    PORT: "3000",
    VITE_API_BASE: API_URL ?? "",
    NODE_ENV: "production",
  }
);

// Copy finca-web build output into the desktop package
if (fs.existsSync(DESKTOP_WEB_DIST)) {
  fs.rmSync(DESKTOP_WEB_DIST, { recursive: true });
}
fs.cpSync(WEB_DIST, DESKTOP_WEB_DIST, { recursive: true });
console.log(`  ✓ Copied web-dist (${countFiles(DESKTOP_WEB_DIST)} files)`);

// ── Step 3: Run electron-builder ─────────────────────────────────────────────

step("3/4  Building installers with electron-builder");

if (!API_URL) {
  console.warn("  ⚠  LAFINCA_API_URL not set — desktop app will use default placeholder");
}

run(
  "pnpm --filter @workspace/finca-desktop electron:build",
  ROOT,
  {
    LAFINCA_API_URL: API_URL ?? "https://lafinca.app",
    LAFINCA_UPDATE_URL: UPDATE_URL ?? "",
  }
);

// ── Step 4: Upload to object storage ─────────────────────────────────────────

step("4/4  Uploading artifacts to object storage");

if (!BUCKET_ID) {
  console.warn("  ⚠  DEFAULT_OBJECT_STORAGE_BUCKET_ID not set — skipping upload");
  console.log("  ℹ  Release files are in:", RELEASE_DIR);
  printReleaseFiles();
  process.exit(0);
}

await uploadArtifacts(BUCKET_ID);

// ── Done ──────────────────────────────────────────────────────────────────────

console.log("\n✅  Build complete\n");
printReleaseFiles();

// ── Utilities ─────────────────────────────────────────────────────────────────

function countFiles(dir: string): number {
  if (!fs.existsSync(dir)) return 0;
  const items = fs.readdirSync(dir, { recursive: true, withFileTypes: true });
  return (items as fs.Dirent[]).filter((i) => i.isFile()).length;
}

function printReleaseFiles(): void {
  if (!fs.existsSync(RELEASE_DIR)) return;
  const files = fs.readdirSync(RELEASE_DIR).filter((f) =>
    /\.(dmg|exe|yml|yaml|blockmap)$/i.test(f)
  );
  if (files.length === 0) return;
  console.log("\nRelease artifacts:");
  files.forEach((f) => {
    const size = fs.statSync(path.join(RELEASE_DIR, f)).size;
    const mb = (size / 1024 / 1024).toFixed(1);
    console.log(`  ${f.padEnd(50)} ${mb} MB`);
  });
}

async function uploadArtifacts(bucketId: string): Promise<void> {
  let Storage: typeof import("@google-cloud/storage").Storage;
  try {
    ({ Storage } = await import("@google-cloud/storage"));
  } catch (e) {
    // @google-cloud/storage is a devDependency of @workspace/finca-desktop.
    // If it is not installed, the upload step cannot proceed — this is a hard error
    // when BUCKET_ID is set (meaning the caller expects the upload to succeed).
    console.error("  ✗  @google-cloud/storage is not installed.");
    console.error("  ✗  Run `pnpm install` at workspace root then retry.");
    process.exit(1);
  }

  const gcs = new Storage();
  const bucket = gcs.bucket(bucketId);

  const prefix = "desktop/updates";
  const uploadTargets = fs
    .readdirSync(RELEASE_DIR)
    .filter((f) => /\.(dmg|exe|yml|yaml|blockmap)$/i.test(f))
    .map((f) => ({
      local: path.join(RELEASE_DIR, f),
      remote: `${prefix}/${f}`,
    }));

  for (const target of uploadTargets) {
    process.stdout.write(`  ↑ Uploading ${path.basename(target.local)} ...`);
    await bucket.upload(target.local, {
      destination: target.remote,
      metadata: { cacheControl: "public, max-age=300" },
    });
    console.log(" ✓");
  }

  console.log(`\n  Update manifest URL: https://storage.googleapis.com/${bucketId}/${prefix}`);
  console.log("  Set LAFINCA_UPDATE_URL to this URL for auto-updates.\n");
}
