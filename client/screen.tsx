import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useHosts, useRpc, type PluginScreenProps } from "@getpaseo/plugin/client";
import { executeWake, listTargets, type TargetSummary } from "../shared/contracts.ts";
import { createWakeController } from "./wake.ts";

type Controller = ReturnType<typeof createWakeController>;

function TargetRow({
  target,
  controller,
  theme,
  disabled,
  online,
  known,
}: {
  target: TargetSummary;
  controller: Controller;
  theme: PluginScreenProps["theme"];
  disabled: boolean;
  online: boolean;
  known: boolean;
}) {
  const state = useSyncExternalStore(controller.subscribe, () => controller.read(target.serverId));
  const waiting = state.status === "waking";
  const blocked = disabled || online || waiting || !known;
  let message = online ? "Online" : "Offline";
  if (!known) message = "Add this target to the app's saved hosts before waking it.";
  else if (!online && waiting) message = "Wake requested. Waiting for Paseo to reconnect…";
  else if (!online && state.status === "error") message = state.message;
  return (
    <View style={{ gap: 8, padding: 16, backgroundColor: theme.colors.surface0 }}>
      <Text style={{ color: theme.colors.foreground, fontWeight: "600" }}>{target.name}</Text>
      <Text style={{ color: theme.colors.foregroundMuted }}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Wake ${target.name}`}
        disabled={blocked}
        onPress={() => controller.wake(target.serverId, target.timeoutMs)}
        style={{ padding: 12, opacity: blocked ? 0.5 : 1, backgroundColor: theme.colors.accent }}
      >
        <Text style={{ color: theme.colors.accentForeground }}>
          {online
            ? "Online"
            : waiting
              ? "Waking…"
              : state.status === "error"
                ? "Retry wake"
                : "Wake"}
        </Text>
      </Pressable>
    </View>
  );
}

export function WakeScreen({ theme, host }: PluginScreenProps) {
  const hosts = useHosts();
  const list = useRpc(listTargets);
  const execute = useRpc(executeWake);
  const controller = useMemo(
    () => createWakeController((serverId) => execute({ targetServerId: serverId })),
    [execute, host.id],
  );
  const [profiles, setProfiles] = useState<{
    targets: TargetSummary[];
  } | null>(null);
  const [error, setError] = useState(false);
  const [revision, setRevision] = useState(0);
  const executorOnline = hosts.some(
    (entry) => entry.serverId === host.id && entry.status === "online",
  );
  useEffect(() => {
    controller.activate();
    return () => controller.dispose();
  }, [controller]);
  useEffect(() => {
    controller.updateOnline(
      hosts.filter((entry) => entry.status === "online").map((entry) => entry.serverId),
    );
  }, [controller, hosts]);
  useEffect(() => {
    let active = true;
    setProfiles(null);
    setError(false);
    void list({})
      .then((value) => {
        if (active) setProfiles(value);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, [list, host.id, revision]);
  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 16 }}
      style={{ backgroundColor: theme.colors.surface0 }}
    >
      <Text style={{ color: theme.colors.foreground }}>Executor: {host.label}</Text>
      <Text style={{ color: theme.colors.foregroundMuted }}>
        Select an online executor using the host picker. Opening this screen never sends a wake
        action.
      </Text>
      {!executorOnline ? (
        <Text style={{ color: theme.colors.foreground }}>
          This executor is offline. Select an online installation.
        </Text>
      ) : null}
      {error ? (
        <Text style={{ color: theme.colors.foreground }}>
          Could not load targets. Check the selected daemon and plugin settings.
        </Text>
      ) : null}
      {!profiles && !error ? (
        <Text style={{ color: theme.colors.foreground }}>Loading targets…</Text>
      ) : null}
      {profiles?.targets.length === 0 ? (
        <Text style={{ color: theme.colors.foreground }}>
          No targets configured. Add them in Settings → Plugins → Wake hosts.
        </Text>
      ) : null}
      {profiles?.targets.map((target) => (
        <TargetRow
          key={`${host.id}:${target.serverId}`}
          target={target}
          controller={controller}
          theme={theme}
          disabled={!executorOnline}
          online={hosts.some(
            (entry) => entry.serverId === target.serverId && entry.status === "online",
          )}
          known={hosts.some((entry) => entry.serverId === target.serverId)}
        />
      ))}
      <Pressable
        accessibilityRole="button"
        onPress={() => setRevision((value) => value + 1)}
        style={{ padding: 12 }}
      >
        <Text style={{ color: theme.colors.foreground }}>Refresh configuration</Text>
      </Pressable>
    </ScrollView>
  );
}
