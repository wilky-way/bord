# Releasing Bord

## How It Works

Bord uses **Tauri's built-in updater** with **GitHub Releases** as the update server. When you push a git tag like `v0.3.0`, a GitHub Actions workflow builds release artifacts for macOS, Windows, and Linux and publishes them as a release. Users running an older version see an in-app banner prompting them to update with one click.

### Flow

```
You push a tag  →  GitHub Actions builds + signs  →  Release published with latest.json
                                                          ↓
User opens app  →  Checks latest.json on launch  →  Banner: "v0.3.0 available"
                                                          ↓
User clicks "Update now"  →  Downloads  →  Installs  →  App relaunches on new version
```

## Cutting a Release

### 1. Bump the version

The version must be updated in **three files** — they must all match:

| File | Field |
|------|-------|
| `package.json` | `"version"` |
| `src-tauri/tauri.conf.json` | `"version"` |
| `src-tauri/Cargo.toml` | `version` under `[package]` |

Use semver: `MAJOR.MINOR.PATCH` (e.g., `0.2.0` → `0.3.0`).

### 2. Commit the version bump

```bash
git add package.json src-tauri/tauri.conf.json src-tauri/Cargo.toml
git commit -m "chore: bump version to 0.3.0"
```

### 3. Tag and push

```bash
git tag v0.3.0
git push origin main --tags
```

The tag push triggers the release workflow.

### 4. Monitor the build

Watch the workflow at: `https://github.com/wilky-way/bord/actions`

The build takes ~10-20 minutes. It produces platform installers/bundles, including:
- macOS: `.dmg` installer (arm64 + x86_64) + updater artifacts (`.app.tar.gz`, `.sig`, `latest.json`)
- Windows: `.msi` / `.exe` installer artifacts
- Linux: `.deb` / `.rpm` packages

### 5. Verify the release

Check `https://github.com/wilky-way/bord/releases/latest` and confirm `latest.json` is present in the assets.

## What the Workflow Does

The workflow at `.github/workflows/release.yml`:

1. **Triggers** on any tag matching `v*`
2. **Builds a multi-platform matrix** in parallel:
   - `aarch64-apple-darwin` (Apple Silicon)
   - `x86_64-apple-darwin` (Intel)
   - `x86_64-pc-windows-msvc` (Windows)
   - `x86_64-unknown-linux-gnu` (Linux, deb/rpm)
3. **Installs Bun and Rust** toolchains
4. **Builds the sidecar** (`bun run build:server` → `dist/bord-server`)
5. **Runs `tauri-apps/tauri-action`** which:
   - Builds the Vite frontend (`bun run build`)
   - Compiles the Rust Tauri shell
   - Bundles everything into a `.dmg` and `.app.tar.gz`
   - Signs the update bundle with the private key
   - Creates a GitHub Release with all artifacts + `latest.json`

## Signing Keys

Update bundles are cryptographically signed so the app can verify they haven't been tampered with.

- **Public key** — embedded in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`. This ships with every copy of the app.
- **Private key** — stored as a GitHub Actions secret (`TAURI_SIGNING_PRIVATE_KEY`). Never committed to the repo.
- **Local backup** — `~/.tauri/bord.key` (keep this safe — if lost, you can't sign updates for existing users).

### Regenerating keys

If you ever need to regenerate (breaks updates for existing users):

```bash
npx tauri signer generate -w ~/.tauri/bord.key
```

Then update the `pubkey` in `tauri.conf.json` and the `TAURI_SIGNING_PRIVATE_KEY` GitHub secret.

## How In-App Updates Work

The update check is in `src/lib/updater.ts`:

1. **On app launch** (3-second delay), `initUpdater()` calls `check()` from `@tauri-apps/plugin-updater`
2. The plugin fetches `https://github.com/wilky-way/bord/releases/latest/download/latest.json`
3. If `latest.json` has a newer version, reactive signals update and `<UpdateBanner />` appears at the top of the app
4. User clicks "Update now" → `installUpdate()` downloads, verifies the signature, installs, and relaunches
5. User can also dismiss the banner, or manually check from **Settings → About → Check for updates**

The updater is a no-op in dev mode (checks for `window.__TAURI_INTERNALS__`).

## GitHub Secrets Required

| Secret | Value |
|--------|-------|
| `TAURI_SIGNING_PRIVATE_KEY` | Contents of `~/.tauri/bord.key` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Empty string (or your key password) |

These are set at: `https://github.com/wilky-way/bord/settings/secrets/actions`

`GITHUB_TOKEN` is provided automatically by GitHub Actions.

## Adjusting Platform Matrix

The workflow already builds macOS, Windows, and Linux. To adjust targets, edit the build matrix in `release.yml`:

```yaml
matrix:
  include:
    # existing platform entries...
    - os: windows-latest
      target: x86_64-pc-windows-msvc
      args: "--target x86_64-pc-windows-msvc"
    - os: ubuntu-latest
      target: x86_64-unknown-linux-gnu
      args: "--target x86_64-unknown-linux-gnu"
```

The `tauri-apps/tauri-action` handles platform-specific bundling automatically.
