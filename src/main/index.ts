import { app, BrowserWindow, shell, nativeImage } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { join } from 'node:path'
import { registerIpc } from './ipc'
import { killAllTerminals } from './terminal'
import { loadDotenv } from './env'
import { installEgressGuard } from './net-guard'

let mainWindow: BrowserWindow | null = null

// Restrict WebRTC's non-proxied UDP so untrusted preview content can't open a
// direct UDP STUN channel (must run before app is ready). NOTE: this REDUCES but
// does NOT eliminate WebRTC as an egress channel — DNS resolution of a STUN/TURN
// hostname and TURN-over-TCP remain, and a script in an untrusted preview can
// reach WebRTC from a child frame. WebRTC cannot be fully blocked from a renderer
// that runs untrusted scripts; the definitive control for secret work is a
// network-isolated machine. See docs/threat-model.md.
app.commandLine.appendSwitch(
  'force-webrtc-ip-handling-policy',
  'disable_non_proxied_udp'
)

const appIcon = nativeImage.createFromPath(
  is.dev
    ? join(__dirname, '../../build/icon.png')
    : join(process.resourcesPath, 'icon.png')
)

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 720,
    minHeight: 480,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    backgroundColor: '#0e0f13',
    icon: appIcon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  // Never open a new Electron window. Only hand off explicit http(s) links to
  // the OS browser (user-visible); deny anything else.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })

  // The app frame must never navigate away from the local app (file:// in prod,
  // localhost dev server in dev). Blocks a page from replacing itself with a
  // remote origin.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const local =
      url.startsWith('file://') ||
      /^https?:\/\/(localhost|127\.0\.0\.1|\[?::1\]?)(:\d+)?(\/|$)/i.test(url)
    if (!local) event.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.orbitlabs.codeone')
  if (process.platform === 'darwin' && !appIcon.isEmpty()) {
    app.dock?.setIcon(appIcon)
  }
  loadDotenv()
  installEgressGuard()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  registerIpc(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  killAllTerminals()
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  killAllTerminals()
})
