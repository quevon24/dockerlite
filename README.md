# DockerLite

[![CI](https://github.com/quevon24/dockerlite/actions/workflows/ci.yml/badge.svg)](https://github.com/quevon24/dockerlite/actions/workflows/ci.yml)

A lightweight, native Docker Desktop replacement for Linux built with [Tauri](https://tauri.app). Connects directly to the local Docker Engine via the Unix socket for high-performance container management.

## Features

- **Container Dashboard** with compose project grouping, bulk actions, and real-time status
- **Real-time Log Streaming** with auto-scroll, timestamps, ANSI stripping, and auto-reconnect on restart
- **Interactive Terminal** (exec) via xterm.js with bidirectional I/O
- **Live Stats Charts** for CPU, memory, and network usage (Recharts)
- **Container Inspect** with collapsible JSON tree viewer and environment variables table
- **Image Management** with multi-select, dangling filter, and bulk delete
- **Volume Management** with orphan detection and delete
- **Network Management** showing connected containers with IPs
- **System Cleanup** with granular prune (containers, images, volumes, networks, build cache) and disk usage breakdown
- **Settings** for socket path, refresh intervals, dark/light theme, and log buffer size
- **Dark Mode** by default with a light theme toggle

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Rust + Tauri v2 |
| Frontend | React 19 + TypeScript |
| Styling | Tailwind CSS v4 + Radix UI |
| Docker API | Bollard (Rust crate) |
| Terminal | xterm.js + @xterm/addon-fit |
| Charts | Recharts |
| Persistence | tauri-plugin-store |
| Packaging | AppImage, .deb, .rpm |

## Prerequisites

### System

- **Linux** (x86_64). Tested on Arch Linux.
- **Docker Engine** installed and running (`sudo systemctl start docker`)
- Your user must be in the `docker` group:
  ```bash
  sudo usermod -aG docker $USER
  # Log out and back in for the change to take effect
  ```

### Development Dependencies

- **Rust** (stable, via [rustup](https://rustup.rs)):
  ```bash
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
  ```
- **Node.js** >= 18 and npm
- **Tauri system dependencies**:

  Arch Linux:
  ```bash
  sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg
  ```

  Ubuntu/Debian:
  ```bash
  sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev
  ```

  For other distros, see the [Tauri prerequisites guide](https://v2.tauri.app/start/prerequisites/).

- **Tauri CLI**:
  ```bash
  cargo install tauri-cli --version "^2"
  ```

## Development

```bash
# Install frontend dependencies
npm install

# Start dev server (hot-reload frontend + Rust rebuild)
cargo tauri dev
```

The app opens at 1280x800 and connects to `/var/run/docker.sock` by default. Change the socket path in Settings if needed.

## Code Quality

The project uses [lefthook](https://github.com/evilmartians/lefthook) to run quality checks as git hooks automatically on every commit and push.

### Activate hooks

Run this once after `npm install`:

```bash
npx lefthook install
```

Two hooks are registered:

| Hook | Checks |
|---|---|
| pre-commit | rustfmt, ESLint, Prettier, TypeScript type check |
| pre-push | Clippy (Rust linter), Vitest (frontend tests) |

### Run checks manually

**Rust:**

```bash
# Auto-format all Rust files
cargo fmt --manifest-path src-tauri/Cargo.toml

# Check formatting without changing files (what the hook runs)
cargo fmt --manifest-path src-tauri/Cargo.toml --check

# Lint (fails on any warning)
cargo clippy --manifest-path src-tauri/Cargo.toml -- -D warnings

# Run integration tests (requires Docker running)
cargo test --manifest-path src-tauri/Cargo.toml
```

**Frontend:**

```bash
# Type check
npm run typecheck

# Lint (ESLint)
npm run lint

# Auto-format with Prettier
npm run format

# Check formatting without changing files (what the hook runs)
npm run format:check

# Run all frontend checks at once
npm run check
```

**Frontend tests:**

```bash
# Run tests once
npm run test

# Watch mode (re-runs on file changes)
npm run test:watch

# With coverage report
npm run test:coverage
```

### Required tools

`rustfmt` and `clippy` ship with the Rust toolchain. If they are missing:

```bash
rustup component add rustfmt clippy
```

ESLint, Prettier, and lefthook are npm devDependencies — `npm install` is all that is needed.

No extra system packages are required beyond the ones listed in [Prerequisites](#prerequisites).

## Build

```bash
# Build all bundle formats (AppImage, .deb, .rpm)
cargo tauri build

# Or build a specific format
cargo tauri build --bundles deb
cargo tauri build --bundles appimage
cargo tauri build --bundles rpm
```

**AppImage requires FUSE.** If the build fails with `failed to run linuxdeploy`, install FUSE:

```bash
# Arch Linux
sudo pacman -S fuse2

# Debian/Ubuntu
sudo apt install libfuse2
```

Output binaries are in `src-tauri/target/release/bundle/`:

| Format | Path |
|---|---|
| AppImage | `appimage/DockerLite_*.AppImage` |
| .deb | `deb/DockerLite_*.deb` |
| .rpm | `rpm/DockerLite-*.rpm` |

The raw binary is also available at `src-tauri/target/release/dockerlite` and can be run directly.

## Releasing

Releases are built automatically by GitHub Actions when a version tag is pushed. The workflow
produces AppImage, .deb, and .rpm artifacts and creates a draft GitHub Release for review.

### Steps to cut a release

1. Bump the version in **both** files (they must match):
   - `src-tauri/tauri.conf.json` — `"version"` field
   - `src-tauri/Cargo.toml` — `version` field

2. Commit the version bump:
   ```bash
   git add src-tauri/tauri.conf.json src-tauri/Cargo.toml
   git commit -m "chore(release): bump version to X.Y.Z"
   ```

3. Merge to `main` via PR as normal.

4. Tag the merge commit and push the tag:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```

5. GitHub Actions builds the binaries and creates a **draft release** automatically. Open the
   [Releases page](https://github.com/quevon24/dockerlite/releases), add release notes, and
   publish when ready.

No tokens or secrets need to be configured — `GITHUB_TOKEN` is provided automatically.

## Architecture

```
Frontend (React)                    Backend (Rust/Tauri)
  invoke() ───────────────────────> #[tauri::command] handlers
  Channel<T> <────────────────────  StreamRegistry (logs, stats)
  onData() ───────────────────────> ExecRegistry (terminal stdin)
```

**One-shot commands** (list, inspect, lifecycle actions) use Tauri's `invoke()` pattern: the frontend calls a named command, the backend queries Docker via Bollard, and returns the serialized result.

**Streaming commands** (logs, stats, terminal output) use Tauri's `Channel<T>` for backend-to-frontend data flow. Each stream is tracked in a `StreamRegistry` so it can be cancelled when the user navigates away or the container restarts. The stream auto-reconnects after container restarts.

**Terminal I/O** uses a hybrid: output flows via `Channel<Vec<u8>>` (high throughput), input flows via individual `invoke("write_exec_input")` calls per keystroke batch (low frequency). The exec session's stdin handle is stored in an `ExecRegistry`.

**Settings** are persisted to `~/.config/dockerlite/settings.json` via `tauri-plugin-store`.

## Project Structure

```
src/                          # React frontend
  lib/                        # Types, API wrappers, hooks, settings
  components/
    layout/                   # Sidebar, AppLayout
    containers/               # ContainerTable, actions, compose groups
    container-detail/         # LogsTab, TerminalTab, StatsTab, InspectTab, EnvTab
    system/                   # SystemSummary cards
    ui/                       # StatusBadge, ConfirmDialog, Toast, ErrorBoundary
  pages/                      # Route-level page components

src-tauri/src/                # Rust backend
  docker/                     # Pure Docker operations (containers, images, volumes, networks, system)
  commands/                   # Tauri command handlers (mirrors docker/ structure + exec)
  state.rs                    # DockerState, StreamRegistry, ExecRegistry
  error.rs                    # Typed error enum with actionable messages
  lib.rs                      # App entry point, plugin/state/command registration
```

## License

MIT
