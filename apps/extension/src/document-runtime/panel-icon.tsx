// SPDX-License-Identifier: Apache-2.0

const paths = {
  "large-text": "M3 5h12M9 5v15M16 11h6M19 11v9",
  "long-text": "M4 5h16M4 10h12M4 15h16M4 20h10",
  "unbreakable-text": "M3 7v10M21 7v10M3 12h18M7 9v6M12 9v6M17 9v6",
  restore: "M5 8h9a6 6 0 0 1 0 12h-3M5 8l4-4M5 8l4 4",
  collapse: "M5 12h14",
  expand: "M7 4h13v13M20 4 4 20",
  close: "M6 6l12 12M18 6 6 18",
  highlight: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M9 12h6",
  navigate: "m4 11 16-7-7 16-2-7-7-2Z",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  copy: "M8 8h12v13H8ZM4 16V3h12",
  clear: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
} as const;

/** Decorative glyphs live inside native buttons; their labels and handlers own the action. */
export function PanelIcon({ name }: { readonly name: keyof typeof paths }) {
  return (
    <svg
      aria-hidden="true"
      className="panel-icon"
      fill="none"
      focusable="false"
      height="16"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.7"
      viewBox="0 0 24 24"
      width="16"
    >
      <path d={paths[name]} />
    </svg>
  );
}
