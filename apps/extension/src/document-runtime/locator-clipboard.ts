// SPDX-License-Identifier: Apache-2.0

/** Best-effort copying uses only a trusted, active gesture and never reads the clipboard. */
export async function requestLocatorCopy(locator: string, boundary: {
  readonly trusted: boolean;
  readonly active: boolean;
  readonly clipboard: Pick<Clipboard, "writeText"> | undefined;
}): Promise<boolean> {
  if (!boundary.trusted || !boundary.active || boundary.clipboard === undefined) return false;
  try {
    await boundary.clipboard.writeText(locator);
    return true;
  } catch {
    return false;
  }
}
