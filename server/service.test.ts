import { expect, it, vi } from "vitest";
import { executeWake, target } from "../shared/contracts.ts";
import { createWakeService } from "./service.ts";

function fixture() {
  const settings = {
    executorTrusted: false,
    targets: [
      target.parse({
        serverId: "pc",
        name: "PC",
        transport: {
          type: "http",
          url: "https://example.com/secret-webhook",
          headerEnv: { Authorization: "WAKE_AUTH" },
        },
      }),
    ],
  };
  const execute = vi.fn().mockResolvedValue({ accepted: true });
  const service = createWakeService(
    async () => settings,
    { execute },
    { WAKE_AUTH: "Bearer secret" },
  );
  return { settings, execute, service };
}

it("rejects an unapproved executor and rechecks revocation on every request", async () => {
  const { settings, execute, service } = fixture();
  await expect(service.wake("pc")).rejects.toThrow("Approve this executor");
  expect(execute).not.toHaveBeenCalled();
  settings.executorTrusted = true;
  await expect(service.wake("pc")).resolves.toEqual({ accepted: true });
  settings.executorTrusted = false;
  await expect(service.wake("pc")).rejects.toThrow("Approve this executor");
  expect(execute).toHaveBeenCalledTimes(1);
});
it("returns only display metadata and resolves credentials exclusively for server delivery", async () => {
  const { settings, execute, service } = fixture();
  settings.executorTrusted = true;
  expect(await service.list()).toEqual({
    executorTrusted: true,
    targets: [{ serverId: "pc", name: "PC", timeoutMs: 120000 }],
  });
  await service.wake("pc");
  expect(execute).toHaveBeenCalledWith(
    "pc",
    expect.objectContaining({ headers: { Authorization: "Bearer secret" }, headerEnv: {} }),
  );
  expect(settings.targets[0].transport).not.toHaveProperty("headers.Authorization");
});
it("refuses unknown targets and arbitrary transports from RPC callers", async () => {
  const { settings, execute, service } = fixture();
  settings.executorTrusted = true;
  await expect(service.wake("unknown")).rejects.toThrow("No wake action");
  expect(execute).not.toHaveBeenCalled();
  expect(() =>
    executeWake.input.parse({ targetServerId: "pc", transport: { url: "http://other" } }),
  ).toThrow();
});
it("fails closed when an environment credential is unavailable", async () => {
  const { settings, execute } = fixture();
  settings.executorTrusted = true;
  const service = createWakeService(async () => settings, { execute }, {});
  await expect(service.wake("pc")).rejects.toThrow("credential environment variable is missing");
  expect(execute).not.toHaveBeenCalled();
});
