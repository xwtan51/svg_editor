import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The real `vscode` module only exists inside the extension host. Unit tests
// resolve it to a minimal stand-in (FileDecoration, EventEmitter, window,
// workspace); classes under src/core never import it at all.
export default defineConfig({
  resolve: {
    alias: {
      vscode: fileURLToPath(new URL("./tests/stubs/vscode.ts", import.meta.url)),
    },
  },
  test: {
    // Unit tests only. The integration tests (tests/integration/) need a real
    // VSCode and run with `npm run test:integration`.
    include: ["tests/unit/**/*.test.ts"],
  },
});
