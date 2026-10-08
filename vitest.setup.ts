import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Only jsdom-environment (component) tests render anything; the node-environment
// unit tests never touch `document`, so this is a no-op for them.
afterEach(() => {
  if (typeof document !== "undefined") cleanup();
});
