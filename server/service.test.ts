import { expect, it, vi } from "vitest";
import { executeWake, target, preferences } from "../shared/contracts.ts";
import { createWakeService } from "./service.ts";

function fixture() {
  const settings = {
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

it("executes a configured target without a separate approval flag", async () => {
  const { execute, service } = fixture();
  await expect(service.wake("pc")).resolves.toEqual({ accepted: true });
  expect(execute).toHaveBeenCalledTimes(1);
});
it("accepts legacy settings while dropping the obsolete approval field", () => {
  const { settings } = fixture();
  expect(preferences.schema.parse({ ...settings, executorTrusted: false })).toEqual(settings);
});
it("returns only display metadata and resolves credentials exclusively for server delivery", async () => {
  const { settings, execute, service } = fixture();
  expect(await service.list()).toEqual({
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
  const { execute, service } = fixture();
  await expect(service.wake("unknown")).rejects.toThrow("No wake action");
  expect(execute).not.toHaveBeenCalled();
  expect(() =>
    executeWake.input.parse({ targetServerId: "pc", transport: { url: "http://other" } }),
  ).toThrow();
});
it("fails closed when an environment credential is unavailable", async () => {
  const { settings, execute } = fixture();
  const service = createWakeService(async () => settings, { execute }, {});
  await expect(service.wake("pc")).rejects.toThrow("credential environment variable is missing");
  expect(execute).not.toHaveBeenCalled();
});
