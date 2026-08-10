// SPDX-License-Identifier: Apache-2.0

export const measurementFrameTimeoutMs = 1_000;

export const nextMeasurementFrame = (view: Window): Promise<boolean> =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (observed: boolean): void => {
      if (settled) return;
      settled = true;
      view.clearTimeout(timeout);
      resolve(observed);
    };
    const timeout = view.setTimeout(
      () => finish(false),
      measurementFrameTimeoutMs,
    );
    try {
      view.requestAnimationFrame(() => finish(true));
    } catch {
      finish(false);
    }
  });
