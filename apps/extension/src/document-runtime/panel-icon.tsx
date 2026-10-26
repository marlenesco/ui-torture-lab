// SPDX-License-Identifier: Apache-2.0

const paths = {
  "large-text": "M3 5h12M9 5v15M16 11h6M19 11v9",
  "long-text": "M4 5h16M4 10h12M4 15h16M4 20h10",
  "unbreakable-text": "M3 7v10M21 7v10M3 12h18M7 9v6M12 9v6M17 9v6",
  restore: "M5 8h9a6 6 0 0 1 0 12h-3M5 8l4-4M5 8l4 4",
  collapse: "M5 12h14",
  expand: "M7 4h13v13M20 4 4 20",
  close: "M6 6l12 12M18 6 6 18",
  info: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0-11v6M12 7h.01",
  highlight: "M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5M9 12h6",
  navigate: "m4 11 16-7-7 16-2-7-7-2Z",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  preview: "M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Zm7 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  copy: "M8 8h12v13H8ZM4 16V3h12",
  clear: "M4 6h16M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7",
} as const;

/** Decorative glyphs live inside native buttons; their labels and handlers own the action. */
export function PanelIcon({ name, plain = false }: { readonly name: keyof typeof paths; readonly plain?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={plain ? "panel-symbol" : "panel-icon"}
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
