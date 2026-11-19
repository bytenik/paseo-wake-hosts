# Changelog

## 0.1.1

- Remove the redundant executor approval setting. Configured targets can be woken directly on the selected daemon.
- Preserve compatibility with existing settings; the obsolete approval field is ignored.
- Keep wake credentials and transport selection on the executor.

## 0.1.0

Initial preview release.

- Manual Wake hosts screen, sidebar entry, and Command Center action using existing Paseo plugin APIs.
- Configured HTTP and IPv4 Wake-on-LAN actions on an explicitly approved executor.
- Executor-side credential resolution, configured-target-only RPCs, duplicate suppression, and no automatic replay after uncertain delivery.
- Reconnection progress, timeout, and explicit retry.

Linux loopback HTTP/UDP and installed-plugin checks are validated. Physical Home Assistant waking and macOS/Windows runtime checks remain pending. This release is distributed through GitHub; it is not published to npm or the Paseo Cafe registry.
