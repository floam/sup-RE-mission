import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const configSource = await readFile(
  new URL("./wallet.ts", import.meta.url),
  "utf8",
);
const layoutSource = await readFile(
  new URL("../app/layout.tsx", import.meta.url),
  "utf8",
);
const providersSource = await readFile(
  new URL("../providers/RootProviders.tsx", import.meta.url),
  "utf8",
);

test("persists Wagmi connections in cookies for SSR refreshes", () => {
  assert.match(configSource, /ssr:\s*true/);
  assert.match(configSource, /storage:\s*createStorage\(\{[\s\S]*storage:\s*cookieStorage/);
  assert.match(layoutSource, /get\("cookie"\)/);
  assert.match(layoutSource, /<RootProviders cookies=\{cookieHeader\}>/);
  assert.match(providersSource, /<ContextProvider cookies=\{cookies\}/);
});
