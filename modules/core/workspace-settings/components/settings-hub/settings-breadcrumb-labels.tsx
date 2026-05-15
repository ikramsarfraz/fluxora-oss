"use client";

import { useEffect } from "react";

import { useBreadcrumbLabels } from "@/components/breadcrumb-label-provider";

import type { SettingsGroup } from "./settings-groups";

export function SettingsBreadcrumbLabels({ groups }: { groups: SettingsGroup[] }) {
  const { setLabel, clearLabel } = useBreadcrumbLabels();

  useEffect(() => {
    const entries: Array<[string, string]> = [["/settings", "Settings"]];
    for (const group of groups) {
      entries.push([`/settings/${group.key}`, group.label]);
      for (const item of group.items) {
        entries.push([item.href, item.label]);
      }
    }

    for (const [href, label] of entries) {
      setLabel(href, label);
    }

    return () => {
      for (const [href] of entries) {
        clearLabel(href);
      }
    };
  }, [groups, setLabel, clearLabel]);

  return null;
}
