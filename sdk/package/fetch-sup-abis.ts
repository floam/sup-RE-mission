import { writeFile } from "node:fs/promises"
import { join } from "node:path"

const BASE_URL = "https://raw.githubusercontent.com/superfluid-org/sup-token/dev/packages/contracts/abis"

const ABI_MAP: Record<string, string> = {
	"main/FluidLocker.json": "FluidLocker.json",
	"main/Fontaine.json": "Fontaine.json",
	"main/StakingRewardController.json": "StakingRewardController.json",
	"main/FluidEPProgramManager.json": "FluidEPProgramManager.json",
	"main/FluidLockerFactory.json": "FluidLockerFactory.json",
	"token/SupToken.json": "SupToken.json",
	"vesting/SupVestingFactory.json": "SupVestingFactory.json",
}

const abisDir = join(import.meta.dirname, "abis")

for (const [remotePath, localFile] of Object.entries(ABI_MAP)) {
	const url = `${BASE_URL}/${remotePath}`
	const res = await fetch(url)
	if (!res.ok) {
		throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`)
	}
	const json = await res.json()
	const dest = join(abisDir, localFile)
	await writeFile(dest, `${JSON.stringify(json, null, "\t")}\n`)
	console.log(`${localFile} ✓`)
}
