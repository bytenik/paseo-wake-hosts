export type WakeState =
  | { status: "idle" }
  | { status: "waking" }
  | { status: "online" }
  | { status: "error"; message: string };

const idle: WakeState = { status: "idle" };
interface Operation {
  timer: ReturnType<typeof setTimeout>;
}

export function createWakeController(execute: (serverId: string) => Promise<unknown>) {
  const states = new Map<string, WakeState>();
  const operations = new Map<string, Operation>();
  const listeners = new Set<() => void>();
  let online = new Set<string>();
  let stopped = false;
  function publish(id: string, state: WakeState) {
    states.set(id, state);
    for (const listener of listeners) listener();
  }
  function finish(id: string, state: WakeState) {
    const operation = operations.get(id);
    if (operation) clearTimeout(operation.timer);
    operations.delete(id);
    publish(id, state);
  }
  return {
    activate() {
      stopped = false;
    },
    read(id: string): WakeState {
      return states.get(id) ?? idle;
    },
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    updateOnline(ids: readonly string[]) {
      online = new Set(ids);
      for (const id of operations.keys()) if (online.has(id)) finish(id, { status: "online" });
      for (const [id, state] of states)
        if (state.status === "online" && !online.has(id)) publish(id, idle);
    },
    wake(id: string, timeoutMs: number) {
      if (stopped || operations.has(id)) return;
      if (online.has(id)) {
        publish(id, { status: "online" });
        return;
      }
      const operation = {
        timer: setTimeout(
          () =>
            finish(id, {
              status: "error",
              message:
                "The host did not reconnect in time. Check its connection before retrying; the wake action may already have arrived.",
            }),
          timeoutMs,
        ),
      };
      operations.set(id, operation);
      publish(id, { status: "waking" });
      void Promise.resolve()
        .then(async () => {
          if (stopped || operations.get(id) !== operation || online.has(id)) return;
          await execute(id);
          // Acceptance is not an online signal. updateOnline completes the operation.
        })
        .catch(() => {
          if (stopped || operations.get(id) !== operation) return;
          finish(id, {
            status: "error",
            message:
              "Wake delivery failed or is uncertain. Check executor trust, configuration, and network access before retrying.",
          });
        });
    },
    dispose() {
      stopped = true;
      for (const operation of operations.values()) clearTimeout(operation.timer);
      operations.clear();
      states.clear();
      listeners.clear();
    },
  };
}
