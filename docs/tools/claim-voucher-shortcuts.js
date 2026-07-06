// biome-ignore lint/suspicious/noConfusingLabels: Shortcuts/bookmarklet payload intentionally starts with javascript:.
javascript: (async () => {
	const APP_ID = "sf-claim-voucher-tool"
	const LS_KEY = "sf.claim.voucherTool.cache.v2"
	const CLAIM_BASES = ["https://claim.superfluid.com", "https://claim.superfluid.org"]
	const CMS_BASE = "https://cms.superfluid.pro"
	const log = (...args) => console.log("[SF Voucher Tool]", ...args)
	const $ = (selector, root = document) => root.querySelector(selector)
	const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector))
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
	const normalizeAddress = (address) => (address || "").toLowerCase()
	const asBig = (value) => {
		if (value == null || value === "") return 0n
		return BigInt(String(value))
	}
	const jsonClone = (value) => JSON.parse(JSON.stringify(value))
	const parseJsonish = (raw) => {
		const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
		return parsed && typeof parsed === "object" && "json" in parsed ? parsed.json : parsed
	}
	const getCache = () => {
		try {
			return JSON.parse(localStorage.getItem(LS_KEY) || "{}")
		} catch {
			return {}
		}
	}
	const setCache = (cache) => localStorage.setItem(LS_KEY, JSON.stringify(cache))
	const accountCache = (account) => {
		const cache = getCache()
		const key = normalizeAddress(account)
		cache[key] ||= { selectedPrograms: {}, selectedVoucherKey: "", vouchers: [] }
		setCache(cache)
		return cache[key]
	}
	const saveAccountCache = (account, data) => {
		const cache = getCache()
		cache[normalizeAddress(account)] = data
		setCache(cache)
	}
	const absoluteClaimUrl = (path) => new URL(path, location.origin).toString()
	const fetchText = async (url, options) => {
		const res = await window.__sfVoucherOriginalFetch(url, options)
		const text = await res.text()
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 260)}`)
		return text
	}
	const fetchJsonish = async (url, options) => parseJsonish(await fetchText(url, options))
	const currentAccount = async () => {
		if (window.ethereum?.request) {
			const accounts = await window.ethereum.request({ method: "eth_accounts" }).catch(() => [])
			if (accounts?.[0]) return accounts[0]
			const requested = await window.ethereum.request({ method: "eth_requestAccounts" }).catch(() => [])
			if (requested?.[0]) return requested[0]
		}
		return (document.body.innerText || "").match(/0x[a-fA-F0-9]{40}/)?.[0] || ""
	}
	const claimStateUrl = (account) =>
		absoluteClaimUrl(`/api/points/states?accountAddress=${encodeURIComponent(account)}`)
	const claimVoucherUrl = (account) =>
		absoluteClaimUrl(`/api/points/claim?accountAddress=${encodeURIComponent(account)}`)
	const mysteryUrl = (account) => absoluteClaimUrl(`/api/mystery-box/check?address=${encodeURIComponent(account)}`)
	const signedBalanceUrls = (account, campaignId) => [
		`${CMS_BASE}/points/signed-balance?campaignId=${encodeURIComponent(campaignId)}&account=${encodeURIComponent(account)}`,
		`${CMS_BASE}/points/signed-balances?campaignId=${encodeURIComponent(campaignId)}&account=${encodeURIComponent(account)}`,
	]
	const signedBalanceBatchUrl = () => `${CMS_BASE}/points/signed-balance-batch`
	const firstSuccessfulJsonish = async (urls) => {
		let lastError
		for (const url of urls) {
			try {
				return await fetchJsonish(url)
			} catch (error) {
				lastError = error
			}
		}
		throw lastError
	}
	const stateRows = (states) => states?.programPointStates || states?.programs || []
	const rowId = (row) => String(row.programId ?? row.campaignId ?? row.id)
	const rowOffchain = (row) => asBig(row.offchainPoints ?? row.points ?? row.totalProgramUnits ?? 0)
	const rowOnchain = (row) => asBig(row.onchainPoints ?? row.onchainUnits ?? 0)
	const claimTxIds = (tx) =>
		(Array.isArray(tx?.programIds) ? tx.programIds : tx?.programId != null ? [tx.programId] : []).map(String)
	const claimTxUnits = (tx) =>
		(Array.isArray(tx?.totalProgramUnits)
			? tx.totalProgramUnits
			: tx?.totalProgramUnits != null
				? [tx.totalProgramUnits]
				: []
		).map(String)
	const signedIds = (signed) =>
		(Array.isArray(signed?.campaignIds)
			? signed.campaignIds
			: signed?.campaignId != null
				? [signed.campaignId]
				: []
		).map(String)
	const signedUnits = (signed) =>
		(Array.isArray(signed?.points) ? signed.points : signed?.points != null ? [signed.points] : []).map(String)
	const voucherKey = (voucher) =>
		[
			voucher.kind,
			voucher.programIds.join(","),
			voucher.totalProgramUnits.join(","),
			voucher.nonce,
			voucher.signature.slice(0, 18),
		].join("|")
	const normalizeClaimVoucher = (claimData, source) => {
		if (!claimData?.canClaim || !claimData.claimTransaction) return null
		const tx = claimData.claimTransaction
		const programIds = claimTxIds(tx)
		const totalProgramUnits = claimTxUnits(tx)
		const voucher = {
			kind: "claim-api",
			source,
			savedAt: Date.now(),
			programIds,
			totalProgramUnits,
			nonce: String(tx.nonce ?? ""),
			signature: String(tx.stackSignature ?? ""),
			claimTransaction: jsonClone(tx),
		}
		voucher.key = voucherKey(voucher)
		return voucher
	}
	const normalizeSignedBalanceVoucher = (signed, source) => {
		const programIds = signedIds(signed)
		const totalProgramUnits = signedUnits(signed)
		if (!programIds.length || !totalProgramUnits.length || !signed?.signatureTimestamp || !signed?.signature)
			return null
		const voucher = {
			kind: programIds.length === 1 ? "cms-single" : "cms-batch",
			source,
			savedAt: Date.now(),
			programIds,
			totalProgramUnits,
			nonce: String(signed.signatureTimestamp),
			signature: String(signed.signature),
			expiresAt: String(signed.signatureExpiresAt ?? ""),
			claimTransaction: {
				type: programIds.length === 1 ? "single" : "batch",
				programId: programIds.length === 1 ? programIds[0] : undefined,
				programIds: programIds.length > 1 ? programIds : undefined,
				totalProgramUnits: programIds.length === 1 ? totalProgramUnits[0] : totalProgramUnits,
				nonce: String(signed.signatureTimestamp),
				stackSignature: String(signed.signature),
			},
			rawSignedBalance: jsonClone(signed),
		}
		voucher.key = voucherKey(voucher)
		return voucher
	}
	const saveVoucher = (account, voucher) => {
		if (!voucher) return null
		const cache = accountCache(account)
		cache.vouchers ||= []
		const existing = cache.vouchers.findIndex((entry) => entry.key === voucher.key)
		if (existing >= 0) cache.vouchers[existing] = voucher
		else cache.vouchers.unshift(voucher)
		cache.vouchers = cache.vouchers.slice(0, 100)
		saveAccountCache(account, cache)
		return voucher
	}
	const latestNonce = (account) => {
		const nonces = (accountCache(account).vouchers || []).map((v) => BigInt(v.nonce || 0)).filter((v) => v > 0n)
		return nonces.length ? nonces.reduce((a, b) => (a > b ? a : b)) : null
	}
	const isStale = (account, voucher) =>
		latestNonce(account) != null && BigInt(voucher.nonce || 0) < latestNonce(account)
	const getStates = (account) => fetchJsonish(claimStateUrl(account))
	const getMysteryBox = (account) => fetchJsonish(mysteryUrl(account)).catch((error) => ({ error: error.message }))
	const fetchClaimVoucher = async (account) =>
		saveVoucher(account, normalizeClaimVoucher(await fetchJsonish(claimVoucherUrl(account)), "claim-api-batch"))
	const fetchCmsSingle = async (account, campaignId) =>
		saveVoucher(
			account,
			normalizeSignedBalanceVoucher(
				await firstSuccessfulJsonish(signedBalanceUrls(account, campaignId)),
				`cms-single:${campaignId}`,
			),
		)
	const fetchCmsBatch = async (account, campaignIds) =>
		saveVoucher(
			account,
			normalizeSignedBalanceVoucher(
				await fetchJsonish(signedBalanceBatchUrl(), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ account, campaignIds: campaignIds.map(Number) }),
				}),
				`cms-batch:${campaignIds.join(",")}`,
			),
		)
	const selectedProgramIds = async () =>
		Object.entries(accountCache(await currentAccount()).selectedPrograms || {})
			.filter(([, enabled]) => enabled)
			.map(([id]) => id)
	const selectedVoucher = async () => {
		const account = await currentAccount()
		const cache = accountCache(account)
		return (cache.vouchers || []).find((voucher) => voucher.key === cache.selectedVoucherKey) || null
	}
	const matchingSubsetVoucher = (account, selectedIds) => {
		const wanted = selectedIds.map(String).sort().join(",")
		return (accountCache(account).vouchers || []).find(
			(voucher) => voucher.programIds.map(String).sort().join(",") === wanted && !isStale(account, voucher),
		)
	}
	const synthesizeSubsetFromSingles = (account, selectedIds) => {
		const singles = selectedIds.map((id) =>
			(accountCache(account).vouchers || []).find(
				(voucher) =>
					voucher.kind === "cms-single" && voucher.programIds[0] === String(id) && !isStale(account, voucher),
			),
		)
		return singles.every(Boolean) ? singles : null
	}
	const responseForVoucher = (voucher) =>
		JSON.stringify({ json: { canClaim: true, claimTransaction: voucher.claimTransaction } })
	const installFetchInterceptor = () => {
		if (window.__sfVoucherOriginalFetch) return
		window.__sfVoucherOriginalFetch = window.fetch.bind(window)
		window.__sfVoucherArmedVoucher = null
		window.fetch = async (input, init) => {
			const url = typeof input === "string" ? input : input?.url || ""
			if (window.__sfVoucherArmedVoucher && /\/api\/points\/claim\?/.test(url)) {
				return new Response(responseForVoucher(window.__sfVoucherArmedVoucher), {
					status: 200,
					headers: { "content-type": "application/json" },
				})
			}
			return window.__sfVoucherOriginalFetch(input, init)
		}
	}
	const css = `#${APP_ID}{position:fixed;right:12px;bottom:12px;z-index:2147483647;width:min(460px,calc(100vw - 24px));max-height:78vh;overflow:auto;background:#071018;color:#e8f6ff;border:1px solid #29d3ff66;border-radius:14px;box-shadow:0 12px 40px #000b;font:13px/1.35 system-ui,sans-serif}#${APP_ID} *{box-sizing:border-box}#${APP_ID} header{position:sticky;top:0;background:#0b1822;border-bottom:1px solid #29d3ff33;padding:10px 12px;display:flex;justify-content:space-between;gap:8px}#${APP_ID} .body{padding:10px 12px 12px}#${APP_ID} button{border:1px solid #29d3ff66;background:#102638;color:#e8f6ff;padding:6px 8px;border-radius:8px;font:inherit}#${APP_ID} button.primary{background:#0c85aa;border-color:#29d3ff;font-weight:700}#${APP_ID} button.danger{border-color:#ff6b6b88;background:#44171c}#${APP_ID} .muted{color:#9db4c2}#${APP_ID} .err{color:#ff9a9a;white-space:pre-wrap}#${APP_ID} .ok{color:#9cffc7}#${APP_ID} .warn{color:#ffd36f}#${APP_ID} .actions{display:flex;flex-wrap:wrap;gap:7px;margin:9px 0}#${APP_ID} .row{display:grid;grid-template-columns:auto 1fr auto;gap:8px;padding:7px 0;border-bottom:1px solid #ffffff14}#${APP_ID} .voucher{display:block;padding:8px;margin:7px 0;border:1px solid #ffffff20;border-radius:10px;background:#ffffff08}#${APP_ID} code{color:#b8ecff;word-break:break-all}`
	const ensureUi = () => {
		let root = document.getElementById(APP_ID)
		if (root) return root
		const style = document.createElement("style")
		style.textContent = css
		document.head.appendChild(style)
		root = document.createElement("section")
		root.id = APP_ID
		root.innerHTML = `<header><b>Superfluid claim voucher tool</b><button data-act="close">×</button></header><div class="body">Loading…</div>`
		document.body.appendChild(root)
		root.addEventListener("change", async (event) => {
			const account = await currentAccount()
			const cache = accountCache(account)
			if (event.target.matches("[data-program-check]"))
				cache.selectedPrograms[event.target.dataset.programCheck] = event.target.checked
			if (event.target.matches("[name='sf-voucher-select']")) cache.selectedVoucherKey = event.target.value
			saveAccountCache(account, cache)
		})
		root.addEventListener("click", async (event) => {
			const button = event.target.closest("[data-act]")
			if (!button) return
			event.preventDefault()
			const action = button.dataset.act
			if (action === "close") root.remove()
			if (action === "refresh") await render()
			if (action === "fetch-claim")
				await fetchClaimVoucher(await currentAccount())
					.then(render)
					.catch((error) => alert(error.message))
			if (action === "fetch-cms-batch")
				await fetchCmsBatch(await currentAccount(), await selectedProgramIds())
					.then(render)
					.catch((error) => alert(error.message))
			if (action === "fetch-cms-singles") {
				const account = await currentAccount()
				for (const id of await selectedProgramIds()) await fetchCmsSingle(account, id).catch(log)
				await render()
			}
			if (action === "arm") await armSelected(false)
			if (action === "arm-click") await armSelected(true)
			if (action === "auto-subset") await autoSubset()
		})
		return root
	}
	const autoSubset = async () => {
		const account = await currentAccount()
		const ids = await selectedProgramIds()
		if (!ids.length) return alert("Select at least one campaign.")
		let voucher = matchingSubsetVoucher(account, ids)
		if (!voucher) {
			for (const id of ids) await fetchCmsSingle(account, id).catch(log)
			const singles = synthesizeSubsetFromSingles(account, ids)
			if (singles?.length === 1) voucher = singles[0]
		}
		if (!voucher)
			return alert(
				"Fetched singles where possible. Multi-campaign subsets still need a CMS batch signature for exactly that subset; separate single signatures cannot be concatenated into one batch signature.",
			)
		const cache = accountCache(account)
		cache.selectedVoucherKey = voucher.key
		saveAccountCache(account, cache)
		await render()
	}
	const armSelected = async (click) => {
		const account = await currentAccount()
		const voucher = await selectedVoucher()
		if (!voucher) return alert("Select a voucher first.")
		if (isStale(account, voucher))
			return alert(
				"Selected voucher has an older nonce than another cached voucher. Fetch a fresh CMS single/batch voucher before arming.",
			)
		window.__sfVoucherArmedVoucher = voucher
		alert(`Armed nonce ${voucher.nonce} for campaign(s): ${voucher.programIds.join(", ")}`)
		if (click) {
			await sleep(250)
			$$("button,[role='button']")
				.find((b) => /claim/i.test(b.innerText || b.textContent || "") && !b.disabled)
				?.click()
		}
		await render()
	}
	const render = async () => {
		installFetchInterceptor()
		const root = ensureUi()
		const body = $(".body", root)
		const account = await currentAccount()
		if (!account) {
			body.innerHTML = `<p class="err">No wallet account found. Connect wallet, then refresh.</p><button data-act="refresh">Refresh</button>`
			return
		}
		body.innerHTML = `<p class="muted">Fetching states for <code>${account}</code>…</p>`
		let states
		let mystery
		let error = ""
		try {
			states = await getStates(account)
			mystery = await getMysteryBox(account)
			const cache = accountCache(account)
			cache.states = states
			cache.mystery = mystery
			saveAccountCache(account, cache)
		} catch (err) {
			error = err.message
			states = accountCache(account).states
			mystery = accountCache(account).mystery
		}
		const cache = accountCache(account)
		const rows = stateRows(states)
		const outdated = rows.filter((row) => row.isOnchainOutdated || rowOffchain(row) !== rowOnchain(row))
		for (const row of outdated) cache.selectedPrograms[rowId(row)] ??= true
		saveAccountCache(account, cache)
		const vouchers = cache.vouchers || []
		body.innerHTML = `${error ? `<p class="err">${error}</p>` : ""}<p>Account: <code>${account}</code><br>Can claim: <b class="${states?.canClaim ? "ok" : "muted"}">${String(!!states?.canClaim)}</b><br>Mystery box: <code>${mystery ? JSON.stringify(mystery).slice(0, 220) : "n/a"}</code></p><div class="actions"><button data-act="refresh">Refresh states</button><button class="primary" data-act="fetch-claim">Fetch claim-app batch</button><button data-act="fetch-cms-batch">Fetch CMS exact batch</button><button data-act="fetch-cms-singles">Fetch CMS singles</button><button class="primary" data-act="auto-subset">Auto subset</button></div><h4>Campaign deltas</h4>${
			outdated.length
				? outdated
						.map((row) => {
							const id = rowId(row)
							const delta = rowOffchain(row) - rowOnchain(row)
							return `<label class="row"><input type="checkbox" data-program-check="${id}" ${cache.selectedPrograms[id] ? "checked" : ""}><span>Campaign <code>${id}</code><br><span class="muted">onchain</span> ${rowOnchain(row)}<br><span class="muted">offchain</span> ${rowOffchain(row)}</span><b class="${delta > 0n ? "ok" : delta < 0n ? "warn" : "muted"}">${delta >= 0n ? "+" : ""}${delta}</b></label>`
						})
						.join("")
				: `<p class="muted">No outdated point states found.</p>`
		}<h4>Cached vouchers</h4>${vouchers.length ? vouchers.map((voucher, index) => `<label class="voucher"><input type="radio" name="sf-voucher-select" value="${voucher.key.replace(/"/g, "&quot;")}" ${cache.selectedVoucherKey === voucher.key ? "checked" : ""}> <b>#${index + 1}</b> <span class="${isStale(account, voucher) ? "warn" : "ok"}">${isStale(account, voucher) ? "stale nonce" : "nonce ok/latest"}</span><br>Kind: <code>${voucher.kind}</code><br>Source: <code>${voucher.source}</code><br>Campaigns: <code>${voucher.programIds.join(", ")}</code><br>Units: <code>${voucher.totalProgramUnits.join(", ")}</code><br>Nonce: <code>${voucher.nonce}</code><br>Expires: <code>${voucher.expiresAt || "unknown"}</code><br>Sig: <code>${voucher.signature.slice(0, 34)}…</code></label>`).join("") : `<p class="muted">No vouchers cached yet.</p>`}<div class="actions"><button class="primary" data-act="arm">Arm selected voucher</button><button class="primary" data-act="arm-click">Arm + click Claim</button></div><p class="muted">Subset note: use <code>cms.superfluid.pro/points/signed-balance</code> to fetch valid single-campaign vouchers. Single signatures are valid for single claim calls; exact multi-campaign subsets need their own batch signature from <code>/points/signed-balance-batch</code>.</p>`
	}
	if (!CLAIM_BASES.some((base) => location.href.startsWith(base)))
		console.warn("Run this on claim.superfluid.com or claim.superfluid.org")
	await render()
})()
