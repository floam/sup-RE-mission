import dotenv from "dotenv"
import { configDefaults, defineConfig } from "vitest/config"

dotenv.config()

// Tests are split into two projects:
// - "unit": hermetic, no network (ABI/address/export checks).
// - "live": simulate against live deployments over a public RPC (files named *.live.test.ts).
// `pnpm test` runs both; `pnpm test:unit` / `pnpm test:live` run them granularly.
export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "unit",
					include: ["tests/**/*.test.ts"],
					exclude: [...configDefaults.exclude, "tests/**/*.live.test.ts"],
				},
			},
			{
				test: {
					name: "live",
					include: ["tests/**/*.live.test.ts"],
				},
			},
		],
	},
})
