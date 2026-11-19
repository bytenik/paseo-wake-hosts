# Remote host waking for Paseo

Status: Manual wake scope agreed; implementation and validation in progress.

## Outcome and boundaries

Wake a saved Paseo computer through an awake executor using either a generic HTTP request or Wake-on-LAN. Home Assistant is an HTTP integration, not a required dependency. The implementation uses existing supported plugin APIs with an unmodified Paseo app and SDK.

App/core changes, agent right-click menu additions, built-in offline-page changes, transparent interception of agent use, prompt queueing, and sleep inhibition are outside scope. Opening an offline workspace, foregrounding the app, or leaving a workspace open never sends a wake action.

## Manual workflow

1. Open Wake hosts from the plugin sidebar entry or global Command Center action.
2. Select an online plugin installation using the existing host picker.
3. Press Wake beside a configured offline target.
4. Show progress until that target's authenticated Paseo connection becomes online, or expose an error with explicit Retry.

The target must be present in the client's saved hosts. The screen disables waking for online targets, unknown targets, and offline executors. Default reconnection timeout is 120 seconds, configurable from 1 to 300 seconds. A successful HTTP response or UDP send is not proof of reconnection.

## Execution and configuration

Each plugin installation is an independent executor with its own host-side target profiles. A profile contains a saved target server ID, display name, reconnection timeout, and one transport. The first release uses JSON settings with revision-aware saves.

The screen calls only its selected installation's existing plugin RPC. Wake requests contain a configured target ID, never a client-supplied URL or transport. The server reloads settings, validates the target ID, resolves credentials locally, and sends the configured action.

There is no automatic discovery, executor failover, shared plan distribution, or profile replication in this release. Another installation can be selected manually if it has an appropriate profile. Cross-host execution through new app APIs is excluded.

## Configuration and access

Configuring wake targets and credentials on a daemon establishes it as an executor. There is no separate approval flag or local/remote trust classification. Existing Paseo access controls govern access to that installation. Wake requests can select only configured target IDs; credentials remain on the executor.

Legacy settings containing `executorTrusted` are accepted, but the obsolete field is ignored and omitted when settings are saved. The setting version remains compatible with existing target profiles.

## HTTP and Home Assistant

HTTP supports POST, PUT, and PATCH, HTTP(S) URLs without embedded username/password, configurable headers, and an optional string body capped at 64 KiB. Request timeout defaults to 10 seconds and is bounded from 100 milliseconds to 30 seconds. Non-2xx responses fail. Redirects are refused.

Authorization headers can reference environment variables on the selected executor. Ordinary Wake screen RPCs return only target metadata; they never return transport plans or resolved credentials. The settings editor can display stored URLs and literal headers to clients authorized to edit that installation. Settings are ordinary JSON, not a secret vault; webhook URLs are credentials too.

The endpoint must expose a repeatable wake-only operation. A disconnected daemon does not prove the computer is asleep. Blind power pulses, toggles, and mains cycling can shut down an awake machine and are unsuitable. The initial Home Assistant power card needs a verified device-specific wake-only action before live configuration.

## Wake-on-LAN

Profiles contain a MAC address, target IPv4 subnet, and UDP port (default 9). The executor selects a matching non-loopback interface, binds to that address, and sends the standard 102-byte magic packet to the subnet's directed broadcast address. Hardware and firmware wake support are external prerequisites. A sleeping MAC alone cannot reveal LAN membership; VPN connectivity does not prove broadcast reachability.

## Lifetime and failures

A screen shares in-flight work for repeated clicks on the same target. Reconnection before queued delivery suppresses the send. Reconnection after delivery completes progress regardless of a late transport error. Closing the screen disposes timers and suppresses queued delivery; it cannot retract a delivered action.

Failed delivery or reconnection timeout is not automatically replayed, redirected to another executor, or followed by another power pulse. Explicit Retry starts another bounded client operation. One executor suppresses repeated target actions for 30 seconds, including failures. Immediate Retry can therefore return the cached result. Suppression is in memory and is not shared across daemons or daemon restarts.

Transport errors omit endpoint URLs, authorization headers, and response bodies. The screen uses generic delivery errors so RPC exceptions cannot expose endpoint secrets.

## Acceptance and validation

- Works with published SDK types and an unmodified compatible Paseo release.
- Sidebar and Command Center actions open the manual screen without sending.
- Only pressing Wake or Retry requests delivery.
- Server rejects unknown targets and arbitrary transport input.
- Credentials resolve on the executor and are absent from target metadata.
- Concurrent clicks coalesce; already-online targets and reconnection before delivery suppress sending.
- Acceptance remains pending until the target reconnects; timeout, delivery failure, disposal, and late errors have defined behavior.
- HTTP integration preserves method, headers, and body; rejects redirects; redacts errors; never automatically replays.
- WOL packet encoding, subnet selection, and loopback UDP delivery are verified.
- A physical endpoint must leave an already-running computer running.
- macOS and Windows runtime validation precedes claims of validated support; portable Node transports alone are insufficient evidence.

The review sequence is spec agreement, plugin implementation, focused unit and loopback integration tests, installed-plugin verification, then device-specific HA validation and a physical sleep/wake test with an independent recovery mechanism ready before suspension. Publishing follows those checks.

## Delivery status

Manual plugin UI, server-side profile execution, focused tests are implemented. The companion app/SDK prototype is excluded from delivery and must not be deployed for this feature.

The Home Assistant wake-only action, physical wake workflow, and macOS/Windows runtime behavior remain unvalidated. Distribution uses a public GitHub repository. Cafe submission follows interface screenshots and the remaining validation.
