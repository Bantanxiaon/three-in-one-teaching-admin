"use client";

import { createContext, useContext, useState, type MouseEvent, type ReactNode } from "react";
import { WorkspaceShell } from "@/components/dashboard/workspace-shell";
import type { Locale } from "@/i18n/routing";
import type { TeacherWorkspaceTab } from "@/lib/teacher-workspace-data";
import type { SerializableWorkspaceItem } from "@/lib/workspace-nav";

const ActiveTeacherTab = createContext<TeacherWorkspaceTab>("overview");

export function TeacherPortalSwitcher({
  locale, name, items, base, initialTab, children
}: {
  locale: Locale;
  name: string;
  items: SerializableWorkspaceItem[];
  base: string;
  initialTab: TeacherWorkspaceTab;
  children: ReactNode;
}) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const activeHref = `${base}?tab=${activeTab}`;

  function navigate(event: MouseEvent<HTMLAnchorElement>, href: string) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const destination = new URL(href, window.location.origin);
    if (destination.pathname !== base) return;
    const tab = destination.searchParams.get("tab");
    if (tab !== "overview" && tab !== "lessons" && tab !== "students") return;
    event.preventDefault();
    if (tab === activeTab) return;
    setActiveTab(tab);
    window.history.replaceState(window.history.state, "", href);
  }

  return (
    <ActiveTeacherTab.Provider value={activeTab}>
      <WorkspaceShell locale={locale} name={name} role={locale === "zh" ? "教师" : locale === "ja" ? "講師" : "Teacher"} items={items} activeHref={activeHref} onNavigate={navigate}>
        {children}
      </WorkspaceShell>
    </ActiveTeacherTab.Provider>
  );
}

export function TeacherTabPanel({ tab, children }: { tab: TeacherWorkspaceTab; children: ReactNode }) {
  return useContext(ActiveTeacherTab) === tab ? <>{children}</> : null;
}
