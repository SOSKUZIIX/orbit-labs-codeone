# CodeOne by Orbit Labs

A multi-provider AI coding workspace that runs locally on macOS, Windows, and Linux. Built on Electron with React.

## Supported providers

- **Anthropic** (Claude Opus 4.7, Sonnet 4.6, Haiku 4.5)
- **OpenAI** (GPT-4o, GPT-4.1, o3-mini, etc.)
- **Google** (Gemini 2.5 Pro/Flash, 2.0 Flash)
API keys are encrypted at rest using the OS keychain (Electron `safeStorage` — Keychain on macOS, DPAPI on Windows, libsecret on Linux when available).

## Develop

```bash
npm install
npm run dev
```

## Package

```bash
# Mac (.dmg, both arm64 and x64)
npm run package:mac

# Windows (.exe NSIS installer, x64)
npm run package:win

# Both at once
npm run package:all
```

Output lands in `dist/`.

## GitHub releases

GitHub Releases are configured in `.github/workflows/release.yml`. Push a
version tag to build installers and publish release assets:

```bash
git tag v0.1.0-beta.1
git push origin v0.1.0-beta.1
```

The workflow uploads stable asset names for the website and in-app update feed:

- `CodeOne-mac.dmg`
- `CodeOne-mac-intel.dmg`
- `CodeOne-win.exe`

See `docs/github-releases.md` for repository secrets, website download URLs,
and the update-feed release process.

## Project layout

```
src/
├── main/           Electron main process (window, IPC, secrets, providers)
│   └── providers/  One file per provider (anthropic, openai, google, ...)
├── preload/        contextBridge that exposes `window.orbit` to the renderer
├── renderer/       React app (Vite)
└── shared/         Types & IPC channel constants used by both sides
```

## Notes

- The renderer runs with `contextIsolation: true` and `nodeIntegration: false`.
- All network requests to providers happen in the **main** process so API keys never enter the renderer.
- Streaming is forwarded chunk-by-chunk over IPC.

## Current surface

- Multi-provider chat
- Workspace file explorer and Monaco editor
- Search, snapshots, image preview, and integrated terminal
- Agent cards for plans, questions, permissions, todos, and file edits
