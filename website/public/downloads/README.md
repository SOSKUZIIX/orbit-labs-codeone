# Downloads

Drop your release binaries in this folder. The landing page download buttons
and the in-app update check both read files served from this directory at
runtime.

Expected filenames:

- `CodeOne-mac.dmg` — universal or arm64 .dmg from `npm run package:mac`
- `CodeOne-mac-intel.dmg` — Intel macOS .dmg
- `CodeOne-win.exe` — NSIS installer from `npm run package:win`

The filenames are configured in `website/lib/downloads.ts`. Local development
serves them from this folder. Production can serve them from object storage or
GitHub Releases by setting `NEXT_PUBLIC_DOWNLOAD_BASE_URL` to a URL such as:

```
https://github.com/orbit-labs/codeone/releases/download/v0.1.0-beta.0
```

Large installers may exceed static upload limits on some hosts, including
Vercel Hobby projects, so use an external download host when needed.

For production, prefer:

```
NEXT_PUBLIC_DOWNLOAD_BASE_URL=https://github.com/orbit-labs/codeone/releases/latest/download
```

## Release workflow

1. Bump the version in the root `package.json` (e.g. `0.1.0-beta.1`).
2. Build:
   ```
   npm run package:mac
   ```
3. Copy the artifacts from `dist/` into this folder, renaming to the names
   above.
4. Update `website/public/latest.json` — bump `latestVersion` and edit the
   `changelog` bullets. The running app polls this file and will surface
   "Update available" in the StatusBar to existing users.
5. Deploy the website.

## Update channel

`website/public/latest.json` is the canonical update feed. Shape:

```json
{
  "latestVersion": "0.1.1",
  "downloadUrl": "/downloads/CodeOne-mac.dmg",
  "changelog": ["First bullet", "Second bullet"]
}
```

The app fetches this from `https://codeone.orbitlabs.dev/latest.json` on
launch. If `latestVersion` is greater than the installed version, the user
gets an "Update available" badge with the changelog.
