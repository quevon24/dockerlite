# DockerLite

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
- **Tauri system dependencies** (Arch Linux):
  ```bash
  sudo pacman -S webkit2gtk-4.1 gtk3 libappindicator-gtk3 librsvg
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

## Build

```bash
# Build optimized release
cargo tauri build
```

Output binaries are in `src-tauri/target/release/bundle/`:

| Format | Path |
|---|---|
| AppImage | `appimage/DockerLite_*.AppImage` |
| .deb | `deb/DockerLite_*.deb` |
| .rpm | `rpm/DockerLite-*.rpm` |

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
