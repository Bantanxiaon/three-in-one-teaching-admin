export const workspaceIconNames = ["dashboard", "calendar", "students", "practice", "settings"] as const;
export type WorkspaceIconName = (typeof workspaceIconNames)[number];

export type SerializableWorkspaceItem = {
  label: string;
  href: string;
  icon: WorkspaceIconName;
};

export function areWorkspaceItemsSerializable(items: Array<{ label: unknown; href: unknown; icon: unknown }>) {
  return items.every((item) =>
    typeof item.label === "string" &&
    typeof item.href === "string" &&
    typeof item.icon === "string" &&
    workspaceIconNames.includes(item.icon as WorkspaceIconName)
  );
}
