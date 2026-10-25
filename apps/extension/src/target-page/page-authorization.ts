// SPDX-License-Identifier: Apache-2.0

export type PageAuthorizationAttempt = {
  readonly id: string;
  expectedUrl: string;
  valid: boolean;
  stop(): void;
};

export const getPageAuthorizationAttempt = (): PageAuthorizationAttempt | undefined =>
  (globalThis as typeof globalThis & { [key: symbol]: PageAuthorizationAttempt | undefined })[
    Symbol.for("ui-torture-lab/page-authorization-attempt")
  ];
