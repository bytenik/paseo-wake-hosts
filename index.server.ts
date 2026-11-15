import type { PluginServerContext } from "@getpaseo/plugin/server";
import { preferences, listTargets, executeWake } from "./shared/contracts.ts";
import { createWakeService } from "./server/service.ts";

export default function contribute(server: PluginServerContext) {
  const settings = server.registerSettings(preferences);
  const service = createWakeService(async () => {
    const state = await settings.read();
    if (state.status !== "ready") throw new Error("Wake configuration could not be loaded");
    return state.values;
  });
  server.handle(listTargets, () => service.list());
  server.handle(executeWake, ({ targetServerId }) => service.wake(targetServerId));
  return () => {};
}
