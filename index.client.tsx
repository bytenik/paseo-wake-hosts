import type { PluginClientContext, PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { Configuration } from "./client/configuration.tsx";
import { WakeScreen } from "./client/screen.tsx";

function Sidebar({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="Power"
      active={currentScreen?.screenId === "wake"}
      onPress={() => openScreen({ screenId: "wake" })}
    />
  );
}

export default function contribute(client: PluginClientContext) {
  const removals = [
    client.addScreen({ id: "wake", title: "Wake hosts", Component: WakeScreen }),
    client.addSidebarHeaderItem({ id: "wake", title: "Wake hosts", Component: Sidebar }),
    client.addCommandCenterItem({
      id: "wake",
      title: "Wake hosts",
      icon: "Power",
      keywords: ["power", "sleep", "wol"],
      context: "global",
      onSelect({ openScreen }) {
        openScreen({ screenId: "wake" });
      },
    }),
    client.addSettingsScreen({
      id: "wake",
      title: "Wake hosts",
      icon: "Power",
      Component: Configuration,
    }),
  ];
  return () => {
    for (const remove of removals) remove();
  };
}
