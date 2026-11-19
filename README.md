# Wake hosts for Paseo

Manually wake a saved Paseo host through Home Assistant, another HTTP service, or Wake-on-LAN. Uses existing plugin APIs and an unmodified Paseo app.

## Install from GitHub

Requires an awake executor with Node 22 or later, npm, and Paseo 0.14 or later with plugins enabled. Install on the executor, not only on the computer that will sleep:

```sh
paseo plugin install git:bytenik/paseo-wake-hosts --ref v0.1.1 --id wake-hosts
```

The manifest declares a locked `npm ci --omit=dev --ignore-scripts` preparation step to install the Zod runtime dependency. Paseo compiles the TypeScript entries. No separate build or patched app is needed.

After installation, `paseo plugin ls` should report `wake-hosts` as running. For updates, use `paseo plugin update wake-hosts`; reinstall with an explicit reference when selecting a particular release. GitHub is the distribution source; this preview is not yet published to npm or Paseo Cafe.

## Validation status

The initial release is a preview. Linux unit and loopback HTTP/UDP integration tests pass, and the plugin loads on an existing Paseo 0.14 executor. Physical Home Assistant wake behavior and macOS/Windows runtime validation are pending. CI checks the portable test suite on all three operating systems; that does not validate device firmware, firewall rules, or an actual physical wake on those systems.

## Use

1. Install the plugin on a machine that stays awake, such as a home server. Enable plugins on that daemon.
2. Open **Settings → Plugins → Wake hosts**, select that executor, and configure its targets.
3. Open **Wake hosts** from the sidebar or search for it in Command Center (⌘K on macOS, Ctrl+K on Windows/Linux).
4. Select the online executor using the screen's host picker, then press **Wake** beside a target.

The screen shows progress until the target's authenticated Paseo connection is online. An HTTP success or sent UDP packet alone does not count as waking. Targets must already exist in the app's saved hosts so their reconnection can be observed. Opening a workspace, foregrounding the app, or opening the Wake screen never sends a wake request.

Execution is manual on the selected installation. The plugin does not add an agent right-click menu item, modify the built-in offline page, intercept prompt submission, or select another executor automatically. If an executor is offline, select another installation with the target configured there.

Configuration templates: [HTTP webhook](examples/http-webhook.json) and [Wake-on-LAN](examples/wol.json). Replace sample host IDs and endpoints, save them on the selected executor.

## HTTP and Home Assistant

The selected executor stores its own profiles and credentials. Example settings:

```json
{
  "targets": [
    {
      "serverId": "srv_workstation",
      "name": "Workstation",
      "timeoutMs": 120000,
      "transport": {
        "type": "http",
        "url": "https://homeassistant.example/api/services/script/turn_on",
        "method": "POST",
        "headers": { "Content-Type": "application/json" },
        "headerEnv": { "Authorization": "PASEO_WAKE_HA_AUTHORIZATION" },
        "body": "{\"entity_id\":\"script.wake_workstation\"}",
        "timeoutMs": 10000
      }
    }
  ]
}
```

Set `PASEO_WAKE_HA_AUTHORIZATION` in the executor daemon's environment to the complete header value, including `Bearer `. A wake-only Home Assistant webhook can use an opaque webhook URL without an authorization header.

The endpoint must implement a repeatable wake-only action. Do not use `switch.toggle`, mains power cycling, or a blind power-button pulse that can turn off a running computer. A disconnected daemon does not establish that the machine is asleep. Validate the device-specific script or webhook against an already-running computer before using it.

HTTP supports POST, PUT, and PATCH, configurable headers, and an optional string body up to 64 KiB. The default request timeout is 10 seconds. Non-2xx responses fail; redirects are refused. Transport errors omit URLs, headers, and response bodies.

## Wake-on-LAN

```json
{
  "targets": [
    {
      "serverId": "srv_lab",
      "name": "Lab workstation",
      "transport": {
        "type": "wol",
        "mac": "02:11:22:33:44:55",
        "network": "192.168.20.0/24",
        "port": 9
      }
    }
  ]
}
```

The executor needs a non-loopback IPv4 interface on the configured subnet. The plugin binds to a matching address and sends the standard 102-byte magic packet to the subnet's directed broadcast address. A MAC alone cannot identify the LAN of a sleeping machine. VPN reachability does not establish broadcast reachability. Target hardware and firmware must support wake from the selected sleep state.

## Trust and credentials

Configuring wake actions and credentials on a daemon establishes it as an executor. There is no separate approval flag. Each installation exposes only its own configured targets. Existing Paseo access controls govern who can use that daemon.

The client sends only a configured target ID. The server chooses the stored transport and resolves environment credentials immediately before delivery. No RPC returns resolved plans or accepts an arbitrary URL, body, or transport. The Wake screen receives only target names, IDs, and timeouts.

Settings are ordinary host-side JSON, not a secret vault. The settings editor displays configured URLs and literal headers to clients authorized to edit that installation's settings. Use environment references for authorization headers. A webhook URL is itself a credential. This plugin does not impose a security boundary on other trusted plugins or clients authorized to manage the daemon.

## Failure and lifetime

The default reconnection window is 120 seconds, configurable from 1 to 300 seconds. Failed delivery or reconnection timeout stays visible with explicit Retry. An uncertain HTTP send is never replayed automatically. Multiple clicks on the same target within one screen share the operation. Each executor suppresses repeated actions for a target for 30 seconds, including failures; immediate Retry may return that cached outcome.

Closing the screen cancels pending local progress and queued delivery. It cannot retract a wake request already sent. Separate executors do not share suppression state. Wake endpoints must tolerate repeated requests.

Refresh the Wake screen after editing settings. Each executor has independent profiles; configuration is not replicated between daemons.

## Development

Requires Node 22 or later for development and a compatible Paseo daemon runtime. Plugin requirements currently allow Paseo 0.14 and later; app and executor compatibility must both hold. No adjacent Paseo checkout or patched SDK is required.

```sh
npm ci --ignore-scripts
npm run typecheck
npm run lint
npm test -- client/wake.test.ts server/service.test.ts server/transports.test.ts
paseo plugin install "$PWD" --id wake-hosts
```

Install under the same `wake-hosts` runtime ID on each executor to use the shared host picker. Reload the plugin after source changes; do not restart the daemon.

Tests cover explicit-only wake lifetime, reconnection, timeouts, duplicate clicks, disposal, server-side credential resolution, unknown-target rejection, HTTP delivery and redaction, redirect refusal, and real UDP loopback packet delivery. Loopback tests do not actuate hardware. Cross-platform runtime testing is required before claiming macOS and Windows validation.

## Troubleshooting

| Symptom                                | Check                                                                                                                            |
| -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Wake hosts does not appear             | Plugins are enabled, the installation is running, and its sidebar item is visible.                                               |
| No targets                             | Select the intended executor and add profiles in that installation's plugin settings. Refresh the Wake screen.                   |
| Wake is disabled                       | Connect the executor and add the target to the app's saved hosts. Already-online targets are disabled.                           |
| HTTP delivery fails                    | Verify the URL, TLS certificate, method, environment credential, and executor reachability. Redirects are deliberately rejected. |
| Wake accepted but target stays offline | Check hardware state and the target daemon separately. Endpoint acceptance does not prove successful waking.                     |
| Immediate Retry behaves the same       | The executor suppresses duplicate target actions for 30 seconds, including failed requests.                                      |
| WOL does not wake                      | Use an executor on the configured LAN and check target NIC, firmware, sleep-state support, and network broadcast filtering.      |

See [SPEC.md](SPEC.md) for scope and operation semantics, [CHANGELOG.md](CHANGELOG.md) for release notes, and [CONTRIBUTING.md](CONTRIBUTING.md) for development checks.

## License

[MIT](LICENSE).
