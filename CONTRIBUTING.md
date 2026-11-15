# Contributing

Use Node 22 or later and npm. Install the locked dependencies with `npm ci --ignore-scripts`.

Before submitting a change, run:

```sh
npm run format:check
npm run typecheck
npm run lint
npm test
```

HTTP and UDP integration tests bind loopback ports. They do not contact a power device. Environments that prohibit local listening sockets cannot run those transport tests.

Keep client code portable across Paseo's desktop, browser, and native clients: use React Native primitives, theme colors, and supported plugin APIs. Keep Node imports and credential resolution in `server/`. No app/core or private SDK extensions are required by this plugin.

Update README examples and the spec when configuration or operation semantics change. Test wake actions against an already-running machine before physical sleep/wake validation. Never include real webhook URLs, credentials, private host inventories, or user data in examples, logs, screenshots, or issues.
