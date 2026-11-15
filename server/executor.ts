import type { WakeTransport } from "../shared/contracts.ts";
import { sendHttp, sendWol } from "./transports.ts";

export function createExecutor() {
  const requests = new Map<string, { started: number; promise: Promise<{ accepted: true }> }>();
  return {
    execute(targetServerId: string, transport: WakeTransport) {
      const now = Date.now();
      for (const [id, entry] of requests) if (now - entry.started > 30000) requests.delete(id);
      const current = requests.get(targetServerId);
      if (current) return current.promise;
      if (requests.size >= 1000)
        throw new Error("Wake request history is full; reload the executor plugin");
      const result = (async (): Promise<{ accepted: true }> => {
        if (transport.type === "http") await sendHttp(transport);
        else await sendWol(transport);
        return { accepted: true };
      })();
      requests.set(targetServerId, { started: now, promise: result });
      return result;
    },
  };
}
