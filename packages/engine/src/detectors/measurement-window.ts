// SPDX-License-Identifier: Apache-2.0

export const measurementFrameTimeoutMs = 1_000;

export const nextMeasurementFrame = (view: Window, signal?: AbortSignal): Promise<boolean> =>
  new Promise((resolve) => {
    if (signal?.aborted) { resolve(false); return; }
    let settled = false;
    let frame: number | undefined;
    const finish = (observed: boolean): void => {
      if (settled) return;
      settled = true;
      view.clearTimeout(timeout);
      if (frame !== undefined) view.cancelAnimationFrame(frame);
      signal?.removeEventListener("abort", abort);
      resolve(observed);
    };
    const abort = (): void => finish(false);
    const timeout = view.setTimeout(() => finish(false), measurementFrameTimeoutMs);
    signal?.addEventListener("abort", abort, { once: true });
    try {
      frame = view.requestAnimationFrame(() => finish(true));
    } catch {
      finish(false);
    }
  });
