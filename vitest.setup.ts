import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// findBy*/waitFor default to a 1s timeout. The Base UI Select/Dialog popups
// these tests open mount in a portal and settle asynchronously (a floating-ui
// measure pass), which regularly takes longer than that when two workers are
// saturating the CPU - the cause of the intermittent "Unable to find role
// option" / "pointer-events: none" failures in the filter and match-dialog
// tests. A longer ceiling costs nothing when the element appears quickly
// (they poll and return as soon as it does) and only matters under load.
configure({ asyncUtilTimeout: 5000 });

// Only jsdom-environment (component) tests render anything; the node-environment
// unit tests never touch `document`, so this is a no-op for them.
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
