import { mkdir, rm } from "node:fs/promises";
import { spawn } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const skillName = "superfluid-points-research";
const skillDir = resolve(repoRoot, "skills", skillName);
const distDir = resolve(repoRoot, "dist");
const outFile = resolve(distDir, `${skillName}.zip`);

await mkdir(distDir, { recursive: true });
await rm(outFile, { force: true });

const args = [
  "-r",
  outFile,
  skillName,
  "-x",
  "*/injector*",
  "*/injector*/**",
  "*.DS_Store",
  "*/.DS_Store",
];

await new Promise((resolvePromise, rejectPromise) => {
  const child = spawn("zip", args, {
    cwd: dirname(skillDir),
    stdio: "inherit",
  });

  child.on("error", rejectPromise);
  child.on("close", (code) => {
    if (code === 0) {
      resolvePromise();
      return;
    }
    rejectPromise(new Error(`zip exited with status ${code}`));
  });
});

console.log(`Built ${outFile}`);
