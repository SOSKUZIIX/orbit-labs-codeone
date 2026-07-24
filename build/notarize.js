// electron-builder afterSign hook — runs notarytool on the signed .app
// bundle and waits for Apple's notarization service to staple a ticket.
//
// Required env vars (set in .env at the repo root or in your shell):
//   APPLE_ID                      e.g. you@yourdomain.com
//   APPLE_APP_SPECIFIC_PASSWORD   e.g. abcd-efgh-ijkl-mnop (from appleid.apple.com)
//   APPLE_TEAM_ID                 e.g. ABCD123456 (the 10-char ID inside the cert name)
//
// If any of these are missing the hook prints a warning and exits 0, so unsigned
// dev builds still succeed.

const { notarize } = require('@electron/notarize')
const path = require('path')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  if (electronPlatformName !== 'darwin') return

  const { APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, APPLE_TEAM_ID } = process.env
  if (!APPLE_ID || !APPLE_APP_SPECIFIC_PASSWORD || !APPLE_TEAM_ID) {
    console.warn(
      '[notarize] Skipping — APPLE_ID / APPLE_APP_SPECIFIC_PASSWORD / APPLE_TEAM_ID not all set. ' +
        'The build is signed but not notarized; users will see Gatekeeper warnings.'
    )
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  console.log(`[notarize] Submitting ${appPath} to Apple…`)
  await notarize({
    tool: 'notarytool',
    appPath,
    appleId: APPLE_ID,
    appleIdPassword: APPLE_APP_SPECIFIC_PASSWORD,
    teamId: APPLE_TEAM_ID
  })
  console.log('[notarize] Done. Ticket stapled.')
}
