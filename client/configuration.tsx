import { useState } from "react";
import { Text, TextInput, View } from "react-native";
import { useSettings, type PluginSurfaceProps } from "@getpaseo/plugin/client";
import { SettingsAction, SettingsCard, SettingsSection } from "@getpaseo/plugin/client/ui";
import { preferences } from "../shared/contracts.ts";

export function Configuration({ theme, host }: PluginSurfaceProps) {
  const settings = useSettings(preferences);
  const [draft, setDraft] = useState<string | null>(null);
  const [revision, setRevision] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const ready = settings.status === "ready";
  const value = draft ?? (ready ? JSON.stringify(settings.values, null, 2) : "");
  async function save() {
    if (!ready) return;
    setMessage("");
    try {
      const parsed = preferences.schema.parse(JSON.parse(value));
      const saved = await settings.save(parsed, revision ?? settings.revision);
      if (!saved) return;
      setDraft(null);
      setRevision(null);
      setMessage("Wake configuration saved.");
    } catch {
      setMessage(
        "Could not apply this wake configuration. Check the fields and required credentials.",
      );
    }
  }
  return (
    <View style={{ gap: 16 }}>
      <Text style={{ color: theme.colors.foreground }}>
        Selected executor: {host.label}. Configure its wake targets here. Credentials remain on this
        daemon. Refresh the Wake hosts screen after saving.
      </Text>
      <SettingsSection title="Wake targets">
        <SettingsCard>
          <TextInput
            multiline
            accessibilityLabel="Wake target configuration"
            value={value}
            editable={ready && !settings.saving}
            onChangeText={(next) => {
              if (ready && draft === null) setRevision(settings.revision);
              setDraft(next);
            }}
            style={{
              color: theme.colors.foreground,
              backgroundColor: theme.colors.surface0,
              minHeight: 240,
              padding: 12,
            }}
          />
          <SettingsAction
            label="Apply configuration"
            actionLabel={settings.saving ? "Saving…" : "Save"}
            disabled={!ready || settings.saving}
            onPress={() => {
              void save();
            }}
          />
        </SettingsCard>
      </SettingsSection>
      {settings.saveError ? (
        <Text style={{ color: theme.colors.foreground }}>{settings.saveError}</Text>
      ) : null}
      {message ? <Text style={{ color: theme.colors.foreground }}>{message}</Text> : null}
    </View>
  );
}
