# GitHub Releases

CodeOne uses GitHub Releases for installer binaries. The website can still
serve local files during development, but production should point download
buttons and the app update feed at release assets.

## Required Repository Secrets

Add these secrets in GitHub under Settings > Secrets and variables > Actions:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `ORBITONE_OPENAI_KEY`

Do not commit production API keys to `.env`.

## Creating A Release

1. Bump `version` in `package.json`.
2. Update `website/public/latest.json` with the new version, changelog, and
   GitHub release asset URL.
3. Commit and push to GitHub.
4. Tag the commit:

   ```sh
   git tag v0.1.0-beta.1
   git push origin v0.1.0-beta.1
   ```

The workflow builds macOS and Windows installers, renames them to stable asset
names, then publishes:

- `CodeOne-mac.dmg`
- `CodeOne-mac-intel.dmg`
- `CodeOne-win.exe`

## Website Downloads

Set this environment variable in the website deployment while shipping beta
prereleases:

```sh
NEXT_PUBLIC_DOWNLOAD_BASE_URL=https://github.com/SOSKUZIIX/orbit-labs-codeone/releases/download/v0.1.0-beta.0
```

GitHub's `/releases/latest` endpoint can ignore prereleases. Use it only after
publishing a stable non-prerelease:

```sh
NEXT_PUBLIC_DOWNLOAD_BASE_URL=https://github.com/SOSKUZIIX/orbit-labs-codeone/releases/latest/download
```

The app update badge reads `https://codeone.orbitlabs.dev/latest.json`. When
`latestVersion` is higher than the installed app version, users see the update
badge and the changelog.

## First-Time GitHub Setup

This project is configured for the GitHub repository:

```sh
https://github.com/SOSKUZIIX/orbit-labs-codeone.git
```

If the repository does not exist yet, create it on GitHub, then push:

```sh
git push -u origin main
```

The GitHub CLI is not required for the release workflow. Pushing a `v*` tag is
enough to build and publish the release through GitHub Actions.
