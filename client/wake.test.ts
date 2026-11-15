import { afterEach, expect, it, vi } from "vitest";
import { createWakeController } from "./wake.ts";

afterEach(() => {
  vi.useRealTimers();
});
const flush = () => new Promise<void>((resolve) => queueMicrotask(resolve));

it("does not send on discovery and sends once for concurrent explicit clicks", async () => {
  const execute = vi.fn().mockResolvedValue({ accepted: true });
  const controller = createWakeController(execute);
  controller.updateOnline([]);
  expect(execute).not.toHaveBeenCalled();
  controller.wake("pc", 1000);
  controller.wake("pc", 1000);
  await flush();
  expect(execute).toHaveBeenCalledExactlyOnceWith("pc");
  expect(controller.read("pc").status).toBe("waking");
  controller.updateOnline(["pc"]);
  expect(controller.read("pc").status).toBe("online");
  controller.dispose();
});
it("does not wake an online host or send after reconnection before delivery", async () => {
  const execute = vi.fn();
  const controller = createWakeController(execute);
  controller.updateOnline(["online"]);
  controller.wake("online", 1000);
  controller.wake("pc", 1000);
  controller.updateOnline(["online", "pc"]);
  await flush();
  expect(execute).not.toHaveBeenCalled();
  controller.dispose();
});
it("times out accepted delivery without replaying and permits explicit retry", async () => {
  vi.useFakeTimers();
  const execute = vi.fn().mockResolvedValue({ accepted: true });
  const controller = createWakeController(execute);
  controller.wake("pc", 1000);
  await vi.advanceTimersByTimeAsync(1000);
  expect(controller.read("pc").status).toBe("error");
  expect(execute).toHaveBeenCalledTimes(1);
  controller.wake("pc", 1000);
  await vi.advanceTimersByTimeAsync(0);
  expect(execute).toHaveBeenCalledTimes(2);
  controller.dispose();
});
it("does not let a late failed send overwrite a reconnected host", async () => {
  let rejectSend: (error: Error) => void = () => {};
  const controller = createWakeController(
    () =>
      new Promise((_resolve, reject) => {
        rejectSend = reject;
      }),
  );
  controller.wake("pc", 1000);
  await flush();
  controller.updateOnline(["pc"]);
  rejectSend(new Error("uncertain"));
  await flush();
  expect(controller.read("pc").status).toBe("online");
  controller.dispose();
});
it("reports send failure without automatic replay", async () => {
  const execute = vi.fn().mockRejectedValue(new Error("secret endpoint"));
  const controller = createWakeController(execute);
  controller.wake("pc", 1000);
  await flush();
  await flush();
  expect(controller.read("pc")).toMatchObject({ status: "error" });
  expect(JSON.stringify(controller.read("pc"))).not.toContain("secret endpoint");
  expect(execute).toHaveBeenCalledTimes(1);
  controller.dispose();
});
it("prevents queued delivery after disposal", async () => {
  const execute = vi.fn();
  const controller = createWakeController(execute);
  controller.wake("pc", 1000);
  controller.dispose();
  await flush();
  expect(execute).not.toHaveBeenCalled();
});

it("can reactivate after effect cleanup without reviving an old send", async () => {
  const execute = vi.fn().mockResolvedValue({ accepted: true });
  const controller = createWakeController(execute);
  controller.wake("pc", 1000);
  controller.dispose();
  controller.activate();
  await flush();
  expect(execute).not.toHaveBeenCalled();
  controller.wake("pc", 1000);
  await flush();
  expect(execute).toHaveBeenCalledExactlyOnceWith("pc");
  controller.dispose();
});
