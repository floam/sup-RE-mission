import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";

const appRoot = path.join(process.cwd(), "research/claim-app-sources/reconstructed");
const hooksDir = path.join(appRoot, "hooks");
const hookFiles = (await readdir(hooksDir)).filter(
  (name) => name.endsWith(".ts") || name.endsWith(".tsx"),
);

for (const name of hookFiles) {
  if (name === "useSuperfluidWriteContract.ts") continue;
  const target = path.join(hooksDir, name);
  let source = await readFile(target, "utf8");
  if (!source.includes("useWriteContract")) continue;

  source = source.replace(
    /import\s*\{([\s\S]*?)\}\s*from\s*"wagmi";/,
    (full, body) => {
      if (!body.includes("useWriteContract")) return full;
      const names = body
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .filter((entry) => entry !== "useWriteContract");
      return `import {\n  ${names.join(",\n  ")},\n} from "wagmi";`;
    },
  );
  source = source.replaceAll(
    "useWriteContract()",
    "useSuperfluidWriteContract()",
  );

  const importLine =
    'import { useSuperfluidWriteContract } from "./useSuperfluidWriteContract";';
  if (!source.includes(importLine)) {
    const marker = '} from "wagmi";';
    const wagmiEnd = source.indexOf(marker);
    if (wagmiEnd < 0) throw new Error(`Could not find wagmi import in ${name}`);
    const insertion = wagmiEnd + marker.length;
    source =
      source.slice(0, insertion) +
      `\n${importLine}\n` +
      source.slice(insertion);
  }
  await writeFile(target, source);
}

const runnabilityPath = path.join(appRoot, "RUNNABILITY.md");
let runnability = await readFile(runnabilityPath, "utf8");
if (!runnability.includes("## Shared write executor and Clear Macro")) {
  runnability += `

## Shared write executor and Clear Macro

All reconstructed contract writes use 'useSuperfluidWriteContract', a TanStack-mutation executor modeled on the Superfluid Dashboard. It keeps concrete ABI/function/argument typing at feature call sites, widens only at the shared '@wagmi/core/writeContract' boundary, applies a 20% gas buffer when no explicit gas limit exists, and preserves the existing simulation/receipt hook surfaces during migration.

The executor supports the Dashboard Clear Macro relay from the beginning. A caller opts in by supplying a typed 'clearMacro' action, and may set 'clearMacroRequired' to prohibit self-paid fallback. Eligibility, on-chain payload assembly, digest verification, EIP-712 signing, relay submission, terminal polling, and pending-execution persistence are implemented. Calls without a macro equivalent remain direct writes; the relay cannot safely execute arbitrary locker calldata.

Browser relay requests use the same-origin '/clearmacro-provider' rewrite because the provider does not expose browser CORS headers. Set 'NEXT_PUBLIC_DISABLE_CLEAR_MACRO=true' as an emergency kill switch.
`;
  await writeFile(runnabilityPath, runnability);
}
