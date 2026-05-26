/**
 * Keyboard shortcut catalogue. Shared by the in-app help drawer and any
 * future standalone shortcut reference so both stay in sync.
 *
 * Each chord is an array of "atoms"; atoms render as styled keys in the UI
 * separated by visual `+` or `→` glyphs (drawn by the renderer based on
 * `connector`).
 *
 * Only list shortcuts that are actually wired up. Aspirational entries lie
 * to users and erode trust in the help surface.
 */

export type ShortcutConnector = "+" | "→";

export type Shortcut = {
  label: string;
  /** Sequence of keys to press. */
  chord: string[];
  /** Connector glyph between keys; defaults to `+`. */
  connector?: ShortcutConnector;
};

export type ShortcutGroup = {
  heading: string;
  shortcuts: Shortcut[];
};

export const shortcutGroups: readonly ShortcutGroup[] = [
  {
    heading: "Global",
    shortcuts: [
      // Handled in app/(app)/_components/help-trigger.tsx
      { label: "Open this help drawer", chord: ["?"] },
      // Handled in components/ui/sidebar.tsx (SidebarProvider)
      { label: "Toggle sidebar", chord: ["⌘", "B"] },
    ],
  },
  {
    // Chord handler lives in app/(app)/_components/global-shortcuts.tsx
    heading: "Create",
    shortcuts: [
      { label: "New sales order", chord: ["N", "O"], connector: "→" },
      { label: "Record supplier bill", chord: ["N", "B"], connector: "→" },
      { label: "Log new expense", chord: ["N", "E"], connector: "→" },
    ],
  },
];

export const totalShortcutCount = shortcutGroups.reduce(
  (sum, group) => sum + group.shortcuts.length,
  0,
);
