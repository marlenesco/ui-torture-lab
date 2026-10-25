// SPDX-License-Identifier: Apache-2.0

import { prepareDocumentRuntime } from "../document-runtime/runtime";

export default defineUnlistedScript(() => {
  prepareDocumentRuntime();
});
