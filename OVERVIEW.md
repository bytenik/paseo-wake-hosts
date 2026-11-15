# Wake hosts

Manually wake offline Paseo computers through HTTP or Wake-on-LAN. Open Wake hosts from the sidebar or Command Center, select an approved online executor, and press Wake beside a configured target.

Uses existing plugin APIs with an unmodified app. Opening a workspace or returning to the app never wakes a computer. The plugin does not change the agent context menu or intercept prompt submission.

Each executor stores its own profiles and must be explicitly approved in plugin settings. Requests contain only a configured target ID; credentials resolve on the executor. Home Assistant integration requires a repeatable wake-only script or webhook. WOL requires the target MAC and IPv4 subnet, with an executor on that LAN.

Progress continues until the target's authenticated Paseo connection becomes online. Failures expose Retry without automatic replay of uncertain delivery. Multiple executors have independent configuration and duplicate suppression.
