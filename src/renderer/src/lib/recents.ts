// Recent workspace folders, stored locally in the app's settings on the main
// process (see src/main/fs.ts). No network, no account.

export async function listRecents(): Promise<string[]> {
  return window.orbit.fs.recentFolders()
}

export async function recordRecent(path: string): Promise<void> {
  await window.orbit.fs.recordRecent(path)
}
