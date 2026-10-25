// SPDX-License-Identifier: Apache-2.0

export const repository = "https://github.com/marlenesco/ui-torture-lab";
export const scenarios = ["Long Text", "Unbreakable Text", "Large Text"] as const;
export const detectors = ["Text Clipping", "Horizontal Containment Overflow", "Viewport Overflow"] as const;
export const navigation = [
  { href: "/docs/", label: "Usage" },
  { href: "/scope/", label: "Supported Scope" },
  { href: "/privacy/", label: "Privacy" },
  { href: "/permissions/", label: "Permissions" },
  { href: "/install/", label: "Install" },
] as const;
