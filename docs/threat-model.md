# CodeOne threat model

CodeOne is built for **secret coding work**. The core promise: a customer's code,
prompts, and projects **never leave their machine**, and **Orbit Labs is
structurally incapable of accessing them** — there is no Orbit server in the
data path. This document states what that guarantee covers, how it is enforced,
and where the honest limits are.

## Trust boundaries

- **Trusted:** the user's machine, the CodeOne binary, the local inference
  runtime on loopback (Ollama etc.).
- **Untrusted:** the network; any workspace file the user opens (a project may
  contain hostile HTML/JS that the preview renders); cloud provider servers
  (only ever reached when the user opts in).
- **Not in the picture at all:** Orbit Labs. There is no account, no login, no
  telemetry, no update ping, no crash reporting, and no server to sync to. Orbit
  Labs cannot see customer data because nothing is ever sent to it.

## Guarantees and how they are enforced

1. **Offline by default.** The default engine ("Orbit 1.2") and the "Local"
   provider run entirely against a loopback inference runtime
   (`127.0.0.1`). No API key, no account, no network. See
   `src/main/providers/local-runtime.ts`.

2. **Cloud is opt-in and off by default.** Claude / GPT / Gemini are hidden and
   refused until the user explicitly enables them (Settings → Online providers,
   behind a confirmation warning). Enforcement is in the **main process**
   (`src/main/ipc.ts` `ChatStart`): a cloud request is rejected unless
   `settings.cloudEnabled` is true. The renderer only hides them; it cannot
   bypass the gate. Default-off holds even for pre-existing installs (the
   settings merge defaults the flag to `false`).

3. **Renderer + preview egress lock.** The in-app preview renders **untrusted
   workspace HTML with scripts enabled** — a natural exfiltration vector. A
   session-level filter (`src/main/net-guard.ts` `installEgressGuard`) cancels
   every **HTTP(S)/WebSocket** request from the UI layer (fetch, XHR, WebSocket,
   image beacon, sub-resource, iframe navigation) unless it targets a local
   scheme (`file:`/`data:`/`blob:`) or loopback. This closes the
   **HTTP(S)/WebSocket** exfiltration paths for a malicious `index.html`
   rendered in the preview, even with scripts running. **WebRTC is a separate,
   non-HTTP channel the guard cannot see; it is only partially mitigated (see
   residual limits) — the definitive control for untrusted content is a
   network-isolated machine.**

4. **Main-process fetch allowlist.** All provider network calls go through
   `safeFetch` (`src/main/net-guard.ts`), which refuses any host that is not
   loopback or one of the three known cloud API hosts. A misconfigured or
   injected endpoint cannot be used to exfiltrate a workspace to an arbitrary
   host. Redirects are refused (`redirect: 'error'`) so an allowed host cannot
   bounce a request onward to a disallowed one. Combined with (2), **when cloud
   is off the app makes zero non-loopback requests.**

5. **Navigation lock.** The app window cannot be navigated to a remote origin
   (`will-navigate` blocks non-local URLs); no new Electron windows are opened;
   only explicit `http(s)` links are handed to the OS browser.

6. **Local-only persistence.** Conversations (`conversations.json`), settings,
   API keys, recents, and the profile are stored on disk in the user's app-data
   directory. Nothing is synced. API keys are encrypted with the OS keychain via
   Electron `safeStorage` when an OS keyring is available (Keychain on macOS,
   DPAPI on Windows); see residual limits for the keyring-less fallback.

7. **Offline licensing.** Access is gated by a 14-day local trial then an
   Ed25519-signed license key, verified locally against an embedded public key
   (`src/main/license.ts`). No activation server; no network.

8. **No baked secrets.** The build embeds no API keys or backend credentials
   (verified against the built `out/main` bundle).

## Residual risks and honest limits

These are the things the design does **not** claim to stop. They are inherent to
a locally-run application and are stated plainly rather than papered over.

- **A patched binary.** Offline license and cloud-gate checks run on the user's
  machine. A determined party can modify the binary to skip them. Signatures
  make license keys **unforgeable**, but cannot stop code modification. This is
  licensing/deterrence, not DRM.
- **Trial-clock reset.** The 14-day trial is tracked locally
  (`userData/license.json`) and resets if the user wipes app data. This is an
  accepted tradeoff of offline trials.
- **Cloud opt-in sends data by design.** If the user turns on a cloud provider
  and uses it, their chat and any workspace files the agent reads are sent to
  that provider (OpenAI/Anthropic/Google) — never to Orbit Labs. The UI badges
  this ("online") and warns on enable. This is the user's explicit choice.
- **Preview external resources are blocked.** A workspace page that pulls a CDN
  script/font will have those requests cancelled. This is intentional (the
  offline guarantee); author previews with inlined/local assets.
- **`window.open` of an http(s) link opens the OS browser.** A preview script
  could, on a user click, open an external URL (carrying data in the URL) in the
  user's browser. It is user-visible and click-gated (popup blocker applies),
  but it is a residual channel; treat untrusted workspace previews with care.
- **WebRTC exfiltration from untrusted previews is mitigated, not eliminated.**
  WebRTC (`RTCPeerConnection` STUN/TURN) is a UDP/DNS channel the HTTP egress
  guard cannot observe. The app restricts non-proxied UDP
  (`force-webrtc-ip-handling-policy=disable_non_proxied_udp`) and strips the
  WebRTC constructors from the preview's top document, which stops the naive
  cases. But a determined script in an untrusted preview can still reach WebRTC
  from a child frame it creates, and can leak data via DNS resolution of an
  attacker-controlled STUN/TURN hostname or TURN-over-TCP — channels that cannot
  be fully closed from inside a Chromium renderer running untrusted scripts.
  **For secret work, run CodeOne on a network-isolated machine** (the intended
  air-gapped deployment), where no channel — WebRTC, DNS, or HTTP — can reach
  anything. Do not open previews of wholly untrusted third-party projects on a
  networked machine.
- **API-key storage on keyring-less systems.** On macOS and Windows, saved cloud
  API keys are OS-encrypted (`safeStorage`). On a system with no OS keyring (some
  Linux setups) `safeStorage` is unavailable and keys fall back to plaintext on
  disk. This affects only the user's own cloud keys (relevant only if they opted
  into cloud), never their code.
- **OS / physical access, and supply chain.** CodeOne does not defend against a
  compromised OS, disk forensics on an unlocked machine, or a malicious
  dependency in its own build. Standard endpoint security applies.
- **Agent terminal commands (`run_command`).** The agent can run shell commands
  in the workspace with the user's own privileges — the same power as the
  in-app terminal. A denylist refuses the obviously catastrophic
  (sudo, disk tools, `rm` on `/` or `~`, recursive Windows deletes) and the
  common network-transfer binaries (curl/wget/ssh/scp/…, PowerShell download
  primitives), because the offline promise means the *agent* should not move
  data off the machine. This is a best-effort backstop, **not a sandbox**:
  general-purpose interpreters (node, python) remain allowed because
  development requires them, and they can perform network I/O. The egress
  guard (`net-guard`) covers the app's own processes, not children spawned by
  commands. On a network-isolated machine (the intended air-gapped deployment)
  this residual channel does not exist. Snapshot/undo covers file damage
  within the workspace.

## What Orbit Labs can see

Nothing. There is no server, no account, no telemetry, and no update feed
contacted by the app. The only network activity the app can perform is (a) to a
loopback runtime, or (b) to a cloud provider the user explicitly enabled — and
in case (b) the data goes to that provider, not to Orbit Labs.
