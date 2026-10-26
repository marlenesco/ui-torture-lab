// SPDX-License-Identifier: Apache-2.0

import { useState, type RefObject } from "react";
import { requestLocatorCopy } from "./locator-clipboard";
import { PanelIcon } from "./panel-icon";

export function LocatorCopy({ locator, target }: {
  readonly locator: string;
  readonly target: RefObject<HTMLElement | null>;
}) {
  const [status, setStatus] = useState<"idle" | "copying" | "copied" | "selected" | "unavailable">("idle");

  return (
    <div className="locator-copy">
      <button
        aria-label={`Copy locator ${locator}`}
        className="panel-toggle"
        disabled={status === "copying"}
        onClick={async (event) => {
          if (!event.isTrusted) return;
          setStatus("copying");
          const copied = await requestLocatorCopy(locator, {
            trusted: event.isTrusted,
            active: navigator.userActivation.isActive,
            clipboard: navigator.clipboard,
          });
          if (copied) {
            setStatus("copied");
            return;
          }
          const element = target.current;
          const selection = element?.ownerDocument.getSelection();
          if (element === null || !element.isConnected || selection === null || selection === undefined) {
            setStatus("unavailable");
            return;
          }
          const range = element.ownerDocument.createRange();
          range.selectNodeContents(element);
          selection.removeAllRanges();
          selection.addRange(range);
          setStatus("selected");
        }}
        title="Copy this diagnostic label; it may match multiple elements"
        type="button"
      >
        <PanelIcon name="copy" />Copy locator
      </button>
      <span className="locator-copy-status" role="status">
        {status === "copied" ? "Locator copied." : status === "selected"
          ? "Clipboard unavailable. Locator selected; press Ctrl+C or ⌘C to copy."
          : status === "unavailable" ? "Clipboard unavailable. Select the displayed locator to copy it manually." : ""}
      </span>
    </div>
  );
}
