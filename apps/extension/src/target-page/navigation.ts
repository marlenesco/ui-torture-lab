// SPDX-License-Identifier: Apache-2.0

/** Observes committed entry changes without intercepting navigation or inspecting router state. */
export function observeSameDocumentNavigation(view: Window, onNavigation: () => void): {
  readonly complete: boolean;
  stop(): void;
} {
  const navigation = view.navigation;
  const complete = navigation !== undefined && navigation.currentEntry !== null;
  const listener = (): void => onNavigation();
  if (complete) navigation.addEventListener("currententrychange", listener);
  else {
    view.addEventListener("popstate", listener);
    view.addEventListener("hashchange", listener);
  }
  return {
    complete,
    stop() {
      if (complete) navigation.removeEventListener("currententrychange", listener);
      else {
        view.removeEventListener("popstate", listener);
        view.removeEventListener("hashchange", listener);
      }
    },
  };
}
