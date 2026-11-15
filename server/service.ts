import type { WakeTarget, WakeTransport } from "../shared/contracts.ts";
import { createExecutor } from "./executor.ts";

interface WakeSettings {
  executorTrusted: boolean;
  targets: WakeTarget[];
}

export function createWakeService(
  read: () => Promise<WakeSettings>,
  executor: {
    execute(id: string, transport: WakeTransport): Promise<{ accepted: true }>;
  } = createExecutor(),
  environment: Record<string, string | undefined> = process.env,
) {
  return {
    async list() {
      const settings = await read();
      return {
        executorTrusted: settings.executorTrusted,
        targets: settings.targets.map(({ transport: _transport, ...summary }) => summary),
      };
    },
    async wake(serverId: string) {
      const settings = await read();
      if (!settings.executorTrusted)
        throw new Error("Approve this executor in Wake hosts settings before using it");
      const entry = settings.targets.find((item) => item.serverId === serverId);
      if (!entry) throw new Error("No wake action is configured for this host");
      if (entry.transport.type === "wol") return executor.execute(serverId, entry.transport);
      const headers = { ...entry.transport.headers };
      for (const [header, variable] of Object.entries(entry.transport.headerEnv)) {
        const value = environment[variable];
        if (!value) throw new Error("A required wake credential environment variable is missing");
        headers[header] = value;
      }
      return executor.execute(serverId, { ...entry.transport, headers, headerEnv: {} });
    },
  };
}
