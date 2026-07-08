// biome-ignore lint/suspicious/noConfusingLabels: Shortcuts/bookmarklet payload intentionally starts with javascript:.
javascript: (async () => {
	const APP_ID = "sf-claim-voucher-tool"
	const TOOL_VERSION = "5.0.0-exact-batch-only"
	const LS_KEY = "sf.claim.voucherTool.cache.v5"
	const MANUAL_ACCOUNT_KEY = "sf.claim.voucherTool.manualAccount.v1"
	const CLAIM_ORIGIN = "https://claim.superfluid.org"
	const CMS_BASE = "https://cms.superfluid.pro"
	const DEFAULT_ACCOUNT = "0xdBb811EC62338db94858Ec21ef1d56B658111922"
	const ADDRESS_RE = /0x[a-fA-F0-9]{40}/
	const MAX_VOUCHERS_PER_ACCOUNT = 160
	const FETCH_TIMEOUT_MS = 20000

	window.__sfVoucherToolState ||= { armedHits: 0, logs: [], providers: [], accountSource: "" }
	const runtime = window.__sfVoucherToolState
	let didComplete = false
	const complete = (result) => {
		if (didComplete) return
		didComplete = true
		if (typeof completion === "function") completion(result)
		else console.log("[SF Voucher Tool] completion", result)
	}

	const h = (value) =>
		String(value ?? "")
			.replace(/&/g, "&amp;")
			.replace(/</g, "&lt;")
			.replace(/>/g, "&gt;")
			.replace(/"/g, "&quot;")
			.replace(/'/g, "&#39;")
	const $ = (selector, root = document) => root.querySelector(selector)
	const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector))
	const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
	const log = (...args) => {
		console.log("[SF Voucher Tool]", ...args)
		const line = args
			.map((arg) => {
				if (arg instanceof Error) return arg.message
				if (typeof arg === "string") return arg
				try {
					return JSON.stringify(arg)
				} catch {
					return String(arg)
				}
			})
			.join(" ")
		runtime.logs.unshift(`${new Date().toLocaleTimeString()} ${line}`)
		runtime.logs = runtime.logs.slice(0, 40)
		const logEl = $(`#${APP_ID} [data-log]`)
		if (logEl) logEl.innerHTML = runtime.logs.map((entry) => `<div>${h(entry)}</div>`).join("")
	}

	const firstAddress = (value) => {
		if (!value) return ""
		if (typeof value === "string") return value.match(ADDRESS_RE)?.[0] || ""
		if (Array.isArray(value)) return value.map(firstAddress).find(Boolean) || ""
		if (typeof value === "object") {
			try {
				return firstAddress(JSON.stringify(value))
			} catch {
				return ""
			}
		}
		return ""
	}
	const normalizeAddress = (address) => firstAddress(address).toLowerCase()
	const asBig = (value) => {
		try {
			return value == null || value === "" ? 0n : BigInt(String(value))
		} catch {
			return 0n
		}
	}
	const formatBig = (value) => asBig(value).toLocaleString("en-US")
	const jsonClone = (value) => (value == null ? value : JSON.parse(JSON.stringify(value)))
	const age = (ms) => {
		const seconds = Math.max(0, Math.floor((Date.now() - Number(ms || 0)) / 1000))
		if (seconds < 90) return `${seconds}s ago`
		const minutes = Math.floor(seconds / 60)
		if (minutes < 90) return `${minutes}m ago`
		const hours = Math.floor(minutes / 60)
		return hours < 48 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`
	}
	const parseJsonish = (raw) => {
		const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
		return parsed && typeof parsed === "object" && "json" in parsed ? parsed.json : parsed
	}

	const emptyAccountCache = () => ({
		selectedPrograms: {},
		selectedVoucherKey: "",
		vouchers: [],
		states: null,
		mystery: null,
		updatedAt: 0,
	})
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
		cache[key] ||= emptyAccountCache()
		setCache(cache)
		return cache[key]
	}
	const saveAccountCache = (account, data) => {
		const cache = getCache()
		cache[normalizeAddress(account)] = data
		setCache(cache)
	}
	const manualAccount = () => normalizeAddress(localStorage.getItem(MANUAL_ACCOUNT_KEY) || "")
	const setManualAccount = (account) => {
		const normalized = normalizeAddress(account)
		if (normalized) localStorage.setItem(MANUAL_ACCOUNT_KEY, normalized)
		else localStorage.removeItem(MANUAL_ACCOUNT_KEY)
		return normalized
	}

	const originalFetch = () => window.__sfVoucherOriginalFetch || window.fetch.bind(window)
	const fetchText = async (url, options = {}) => {
		const controller = new AbortController()
		const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
		try {
			const res = await originalFetch()(url, { ...options, signal: controller.signal })
			const text = await res.text()
			if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${text.slice(0, 360)}`)
			return text
		} finally {
			clearTimeout(timeout)
		}
	}
	const fetchJsonish = async (url, options) => parseJsonish(await fetchText(url, options))

	const addProvider = (providers, seen, provider, info = {}) => {
		if (!provider || typeof provider.request !== "function" || seen.has(provider)) return
		seen.add(provider)
		providers.push({ provider, info })
	}
	const isRabbyProvider = ({ provider, info }) =>
		!!provider?.isRabby || /rabby/i.test(info?.name || "") || /rabby/i.test(info?.rdns || "")
	const providerLabel = ({ provider, info }) =>
		info?.name || (provider?.isRabby ? "Rabby" : provider?.isMetaMask ? "MetaMask" : "Injected wallet")
	const discoverProviders = async () => {
		const providers = []
		const seen = new Set()
		for (const provider of window.ethereum?.providers || []) addProvider(providers, seen, provider)
		addProvider(providers, seen, window.ethereum?.selectedProvider)
		addProvider(providers, seen, window.ethereum)
		addProvider(providers, seen, window.rabby)
		addProvider(providers, seen, window.rabbyWallet)
		await new Promise((resolve) => {
			const onProvider = (event) => addProvider(providers, seen, event.detail?.provider, event.detail?.info)
			window.addEventListener("eip6963:announceProvider", onProvider)
			window.dispatchEvent(new Event("eip6963:requestProvider"))
			setTimeout(() => {
				window.removeEventListener("eip6963:announceProvider", onProvider)
				resolve()
			}, 250)
		})
		providers.sort((a, b) => Number(isRabbyProvider(b)) - Number(isRabbyProvider(a)))
		runtime.providers = providers.map((entry) => ({ label: providerLabel(entry), rabby: isRabbyProvider(entry) }))
		return providers
	}
	const providerAccounts = async (provider, request) => {
		const existing = firstAddress(await provider.request({ method: "eth_accounts" }).catch(() => []))
		if (existing) return existing
		const selected = firstAddress(provider.selectedAddress) || firstAddress(provider._state?.accounts)
		if (selected) return selected
		return request ? firstAddress(await provider.request({ method: "eth_requestAccounts" }).catch(() => [])) : ""
	}
	const currentAccount = async ({ request = false, allowFallback = true } = {}) => {
		const manual = manualAccount()
		if (manual) {
			runtime.accountSource = "manual override"
			return manual
		}
		for (const { provider } of await discoverProviders()) {
			const account = normalizeAddress(await providerAccounts(provider, request))
			if (account) {
				runtime.accountSource = "wallet provider"
				return account
			}
		}
		if (!allowFallback) {
			runtime.accountSource = "none"
			return ""
		}
		for (const storage of [localStorage, sessionStorage]) {
			for (let i = 0; i < storage.length; i++) {
				const key = storage.key(i)
				const account = normalizeAddress(`${key}\n${storage.getItem(key)}`)
				if (account) {
					runtime.accountSource = "page storage"
					return account
				}
			}
		}
		const visible = normalizeAddress(document.body.innerText || "")
		if (visible) {
			runtime.accountSource = "page text"
			return visible
		}
		runtime.accountSource = "default account"
		return normalizeAddress(DEFAULT_ACCOUNT)
	}

	const claimUrl = (path) => new URL(path, CLAIM_ORIGIN).toString()
	const claimStateUrl = (account) => claimUrl(`/api/points/states?accountAddress=${encodeURIComponent(account)}`)
	const claimVoucherUrl = (account) => claimUrl(`/api/points/claim?accountAddress=${encodeURIComponent(account)}`)
	const mysteryUrl = (account) => claimUrl(`/api/mystery-box/check?address=${encodeURIComponent(account)}`)
	const signedBalanceBatchUrl = () => `${CMS_BASE}/points/signed-balance-batch`

	const stateRows = (states) => states?.programPointStates || []
	const rowId = (row) => String(row.programId)
	const rowOffchain = (row) => asBig(row.offchainPoints)
	const rowOnchain = (row) => asBig(row.onchainPoints)
	const rowDelta = (row) => rowOffchain(row) - rowOnchain(row)
	const isPositiveOutdated = (row) => row.isOnchainOutdated && rowDelta(row) > 0n
	const sortedRows = (states) =>
		stateRows(states)
			.filter((row) => row?.programId && (row.isOnchainOutdated || rowDelta(row) !== 0n))
			.sort((a, b) => Number(rowId(a)) - Number(rowId(b)))
	const idsKey = (ids) =>
		ids
			.map(String)
			.sort((a, b) => Number(a) - Number(b))
			.join(",")
	const selectedProgramIdsFor = (account) =>
		Object.entries(accountCache(account).selectedPrograms || {})
			.filter(([, enabled]) => enabled)
			.map(([id]) => id)
			.sort((a, b) => Number(a) - Number(b))
	const targetUnitsById = (account) => {
		const units = {}
		for (const row of stateRows(accountCache(account).states)) units[rowId(row)] = String(row.offchainPoints)
		return units
	}
	const voucherUnitsById = (voucher) =>
		Object.fromEntries(
			(voucher?.programIds || []).map((id, i) => [String(id), String(voucher.totalProgramUnits?.[i] ?? "")]),
		)
	const claimTxIds = (tx) =>
		(Array.isArray(tx?.programIds) ? tx.programIds : tx?.programId != null ? [tx.programId] : []).map(String)
	const claimTxUnits = (tx) =>
		(Array.isArray(tx?.totalProgramUnits)
			? tx.totalProgramUnits
			: tx?.totalProgramUnits != null
				? [tx.totalProgramUnits]
				: []
		).map(String)
	const voucherKey = (voucher) =>
		[
			voucher.kind,
			voucher.programIds.join(","),
			voucher.totalProgramUnits.join(","),
			voucher.nonce,
			voucher.signature.slice(0, 18),
		].join("|")

	const normalizeClaimVoucher = (claimData, source) => {
		const tx = claimData?.claimTransaction
		if (!tx) return null
		const programIds = claimTxIds(tx)
		const totalProgramUnits = claimTxUnits(tx)
		if (!programIds.length || programIds.length !== totalProgramUnits.length) return null
		const voucher = {
			kind: "claim-api-reference",
			source,
			savedAt: Date.now(),
			programIds,
			totalProgramUnits,
			nonce: String(tx.nonce ?? ""),
			signature: String(tx.stackSignature ?? ""),
			claimTransaction: jsonClone(tx),
			rawClaim: jsonClone(claimData),
		}
		voucher.key = voucherKey(voucher)
		return voucher
	}
	const normalizeSignedBalanceVoucher = (signed, source) => {
		const programIds = (signed?.campaignIds || []).map(String)
		const totalProgramUnits = (signed?.points || []).map(String)
		if (
			!programIds.length ||
			programIds.length !== totalProgramUnits.length ||
			!signed?.signatureTimestamp ||
			!signed?.signature
		)
			throw new Error("Unexpected CMS signed-balance-batch response shape")
		const claimTransaction = {
			type: programIds.length === 1 ? "single" : "batch",
			programId: programIds.length === 1 ? programIds[0] : undefined,
			programIds: programIds.length > 1 ? programIds : undefined,
			totalProgramUnits: programIds.length === 1 ? totalProgramUnits[0] : totalProgramUnits,
			nonce: String(signed.signatureTimestamp),
			stackSignature: String(signed.signature),
		}
		const voucher = {
			kind: "cms-batch",
			source,
			savedAt: Date.now(),
			programIds,
			totalProgramUnits,
			nonce: String(signed.signatureTimestamp),
			signature: String(signed.signature),
			signer: String(signed.signer || ""),
			claimTransaction,
			rawSignedBalance: jsonClone(signed),
		}
		voucher.key = voucherKey(voucher)
		return voucher
	}
	const saveVoucher = (account, voucher) => {
		if (!voucher) return null
		const cache = accountCache(account)
		const existing = cache.vouchers.findIndex((entry) => entry.key === voucher.key)
		if (existing >= 0) cache.vouchers[existing] = voucher
		else cache.vouchers.unshift(voucher)
		cache.vouchers = cache.vouchers
			.sort((a, b) => Number(asBig(b.nonce) - asBig(a.nonce)) || Number(b.savedAt || 0) - Number(a.savedAt || 0))
			.slice(0, MAX_VOUCHERS_PER_ACCOUNT)
		cache.selectedVoucherKey = voucher.key
		saveAccountCache(account, cache)
		return voucher
	}
	const latestNonce = (account) => {
		const nonces = (accountCache(account).vouchers || []).map((v) => asBig(v.nonce)).filter((v) => v > 0n)
		return nonces.length ? nonces.reduce((a, b) => (a > b ? a : b)) : null
	}
	const isStale = (account, voucher) => latestNonce(account) != null && asBig(voucher?.nonce) < latestNonce(account)
	const matchesIdsAndCurrentTotals = (account, voucher, ids) => {
		if (!voucher || idsKey(voucher.programIds || []) !== idsKey(ids)) return false
		if (isStale(account, voucher)) return false
		const target = targetUnitsById(account)
		const units = voucherUnitsById(voucher)
		return ids.every((id) => target[id] != null && units[id] === target[id])
	}
	const matchingSubsetVoucher = (account, ids) =>
		(accountCache(account).vouchers || []).find((voucher) => matchesIdsAndCurrentTotals(account, voucher, ids)) || null
	const selectedVoucherFor = (account) =>
		(accountCache(account).vouchers || []).find(
			(voucher) => voucher.key === accountCache(account).selectedVoucherKey,
		) || null

	const getStates = (account) => fetchJsonish(claimStateUrl(account))
	const getMysteryBox = (account) => fetchJsonish(mysteryUrl(account)).catch((error) => ({ error: error.message }))
	const fetchClaimVoucher = async (account) =>
		saveVoucher(account, normalizeClaimVoucher(await fetchJsonish(claimVoucherUrl(account)), "claim-api-reference"))
	const fetchCmsBatch = async (account, ids) => {
		const campaignIds = ids.map(Number).sort((a, b) => a - b)
		if (!campaignIds.length) throw new Error("Select at least one campaign first.")
		return saveVoucher(
			account,
			normalizeSignedBalanceVoucher(
				await fetchJsonish(signedBalanceBatchUrl(), {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ account, campaignIds }),
				}),
				`cms-batch:${campaignIds.join(",")}`,
			),
		)
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
				runtime.armedHits += 1
				log(
					"served armed voucher",
					window.__sfVoucherArmedVoucher.programIds.join(","),
					"nonce",
					window.__sfVoucherArmedVoucher.nonce,
				)
				return new Response(responseForVoucher(window.__sfVoucherArmedVoucher), {
					status: 200,
					headers: { "content-type": "application/json" },
				})
			}
			return window.__sfVoucherOriginalFetch(input, init)
		}
	}
	const nativeClaimButton = () =>
		$$("button,[role='button']").find(
			(el) => !el.disabled && /\bclaim\b/i.test(el.innerText || el.textContent || el.getAttribute("aria-label") || ""),
		)
	const copyText = async (text) =>
		navigator.clipboard?.writeText ? navigator.clipboard.writeText(text) : prompt("Copy this:", text)

	const refreshData = async (account) => {
		let states
		let mystery
		let error = ""
		try {
			states = await getStates(account)
			mystery = await getMysteryBox(account)
			const cache = accountCache(account)
			cache.states = states
			cache.mystery = mystery
			cache.updatedAt = Date.now()
			for (const row of sortedRows(states).filter(isPositiveOutdated)) cache.selectedPrograms[rowId(row)] ??= true
			saveAccountCache(account, cache)
		} catch (err) {
			error = err.message
			states = accountCache(account).states
			mystery = accountCache(account).mystery
		}
		return { states, mystery, error }
	}
	const fetchExactSelected = async () => {
		const account = await currentAccount()
		const ids = selectedProgramIdsFor(account)
		const voucher = matchingSubsetVoucher(account, ids) || (await fetchCmsBatch(account, ids))
		accountCache(account).selectedVoucherKey = voucher.key
		saveAccountCache(account, accountCache(account))
		await render()
	}
	const armSelected = async (click) => {
		const account = await currentAccount()
		const voucher = selectedVoucherFor(account)
		if (!voucher) return alert("Select a voucher first.")
		if (isStale(account, voucher)) return alert("Selected voucher is stale. Fetch exact selected first.")
		const ids = selectedProgramIdsFor(account)
		if (!matchesIdsAndCurrentTotals(account, voucher, ids))
			return alert(
				"Selected voucher does not match the selected campaigns and current offchain totals. Fetch exact selected first.",
			)
		window.__sfVoucherArmedVoucher = voucher
		const beforeHits = runtime.armedHits
		log("armed voucher", voucher.programIds.join(","), "nonce", voucher.nonce)
		if (click) {
			await sleep(250)
			const button = nativeClaimButton()
			if (!button) alert("Armed, but no native Claim button was found.")
			else button.click()
			setTimeout(() => {
				if (runtime.armedHits === beforeHits)
					log(
						"warning: native click did not request /api/points/claim; the app may have reused its own cached transaction",
					)
			}, 1500)
		}
		await render()
	}

	const css = `#${APP_ID}{position:fixed;right:10px;bottom:10px;z-index:2147483647;width:min(560px,calc(100vw - 20px));max-height:82vh;overflow:auto;background:#071018;color:#e8f6ff;border:1px solid #29d3ff66;border-radius:14px;box-shadow:0 14px 44px #000c;font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}#${APP_ID} *{box-sizing:border-box}#${APP_ID} header{position:sticky;top:0;background:#0b1822;border-bottom:1px solid #29d3ff33;padding:9px 10px;display:flex;justify-content:space-between;gap:8px;align-items:center}#${APP_ID} .body{padding:9px 10px 12px}#${APP_ID} button{border:1px solid #29d3ff66;background:#102638;color:#e8f6ff;padding:5px 7px;border-radius:8px;font:inherit;cursor:pointer}#${APP_ID} button.primary{background:#0c85aa;border-color:#29d3ff;font-weight:700}#${APP_ID} button.danger{border-color:#ff6b6b88;background:#44171c}#${APP_ID} .muted{color:#9db4c2}#${APP_ID} .err{color:#ff9a9a;white-space:pre-wrap}#${APP_ID} .ok{color:#9cffc7}#${APP_ID} .warn{color:#ffd36f}#${APP_ID} .actions{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}#${APP_ID} .grid{display:grid;grid-template-columns:1fr 1fr;gap:6px}#${APP_ID} .row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:7px;padding:6px 0;border-bottom:1px solid #ffffff14;align-items:start}#${APP_ID} .voucher{display:block;padding:7px;margin:6px 0;border:1px solid #ffffff20;border-radius:10px;background:#ffffff08}#${APP_ID} code{color:#b8ecff;word-break:break-all}#${APP_ID} details{border:1px solid #ffffff18;border-radius:10px;padding:6px;margin:7px 0;background:#ffffff05}`
	const ensureUi = () => {
		let root = document.getElementById(APP_ID)
		if (root) return root
		const style = document.createElement("style")
		style.textContent = css
		document.head.appendChild(style)
		root = document.createElement("section")
		root.id = APP_ID
		root.innerHTML = `<header><b>Superfluid claim voucher tool <span class="muted">v${h(TOOL_VERSION)}</span></b><button data-act="close">×</button></header><div class="body">Loading…</div>`
		document.body.appendChild(root)
		root.addEventListener("change", async (event) => {
			if (!(event.target instanceof Element)) return
			const account = await currentAccount()
			const cache = accountCache(account)
			if (event.target.matches("[data-program-check]"))
				cache.selectedPrograms[event.target.dataset.programCheck] = event.target.checked
			if (event.target.matches("[name='sf-voucher-select']")) cache.selectedVoucherKey = event.target.value
			saveAccountCache(account, cache)
		})
		root.addEventListener("click", async (event) => {
			if (!(event.target instanceof Element)) return
			const button = event.target.closest("[data-act]")
			if (!button) return
			event.preventDefault()
			try {
				const action = button.dataset.act
				if (action === "close") root.remove()
				if (action === "refresh") await render({ forceRefresh: true })
				if (action === "connect")
					await currentAccount({ request: true, allowFallback: false }).then(() => render({ forceRefresh: true }))
				if (action === "manual-account") {
					const account = prompt("Account address:", manualAccount() || DEFAULT_ACCOUNT)
					if (account != null) setManualAccount(account)
					await render({ forceRefresh: true })
				}
				if (action === "fetch-exact") await fetchExactSelected()
				if (action === "fetch-reference") await fetchClaimVoucher(await currentAccount()).then(() => render())
				if (action === "arm") await armSelected(false)
				if (action === "arm-click") await armSelected(true)
				if (action === "disarm") {
					window.__sfVoucherArmedVoucher = null
					await render()
				}
				if (action === "copy") {
					const voucher = selectedVoucherFor(await currentAccount())
					if (voucher) await copyText(responseForVoucher(voucher))
				}
				if (action === "export") await copyText(JSON.stringify({ [LS_KEY]: getCache() }, null, 2))
				if (action === "clear") {
					const account = await currentAccount()
					if (confirm(`Clear cache for ${account}?`)) saveAccountCache(account, emptyAccountCache())
					await render({ forceRefresh: true })
				}
			} catch (error) {
				log("action failed", error)
				alert(error.message || String(error))
			}
		})
		return root
	}
	const render = async ({ forceRefresh = false } = {}) => {
		installFetchInterceptor()
		const root = ensureUi()
		const body = $(".body", root)
		const account = await currentAccount()
		const cacheBefore = accountCache(account)
		body.innerHTML = `<p class="muted">Loading claim state for <code>${h(account)}</code>…</p>`
		const { states, mystery, error } =
			forceRefresh || !cacheBefore.states || Date.now() - Number(cacheBefore.updatedAt || 0) > 30000
				? await refreshData(account)
				: { states: cacheBefore.states, mystery: cacheBefore.mystery, error: "" }
		const cache = accountCache(account)
		const rows = sortedRows(states)
		const selectedIds = selectedProgramIdsFor(account)
		const vouchers = cache.vouchers || []
		const selectedVoucher = selectedVoucherFor(account)
		const exactVoucher = selectedIds.length ? matchingSubsetVoucher(account, selectedIds) : null
		const selectedDelta = rows
			.filter((row) => selectedIds.includes(rowId(row)))
			.reduce((sum, row) => sum + rowDelta(row), 0n)
		body.innerHTML = `${error ? `<p class="err">${h(error)}</p>` : ""}<div class="grid"><div>Account<br><code>${h(account)}</code></div><div>Account source<br><b class="${runtime.accountSource === "wallet provider" ? "ok" : "warn"}">${h(runtime.accountSource)}</b></div><div>Can claim<br><b class="${states?.canClaim ? "ok" : "muted"}">${h(String(!!states?.canClaim))}</b></div><div>Selected<br><b>${h(selectedIds.length)}</b> campaign(s)<br><span class="muted">delta ${selectedDelta >= 0n ? "+" : ""}${h(formatBig(selectedDelta))}</span></div><div>Exact selected voucher<br><b class="${exactVoucher ? "ok" : "warn"}">${exactVoucher ? "cached/current" : selectedIds.length ? "missing" : "n/a"}</b></div><div>Armed<br><b class="${window.__sfVoucherArmedVoucher ? "ok" : "muted"}">${window.__sfVoucherArmedVoucher ? `nonce ${h(window.__sfVoucherArmedVoucher.nonce)}` : "no"}</b><br><span class="muted">hits ${h(runtime.armedHits)}</span></div></div><p class="muted">Updated: ${cache.updatedAt ? h(age(cache.updatedAt)) : "never"}<br>Providers: ${h(runtime.providers.map((p) => `${p.label}${p.rabby ? " (Rabby)" : ""}`).join(", ") || "none")}<br>Mystery box: <code>${h(mystery ? JSON.stringify(mystery).slice(0, 220) : "n/a")}</code></p><div class="actions"><button data-act="refresh">Refresh states</button><button data-act="connect">Connect wallet</button><button data-act="manual-account">Manual account</button>${manualAccount() ? `<button class="danger" data-act="clear-manual">Clear manual</button>` : ""}<button class="primary" data-act="fetch-exact">Fetch exact selected</button><button data-act="fetch-reference">Fetch claim-app reference</button></div><h4>Campaign deltas <span class="muted">(voucher signs full offchain totals)</span></h4>${
			rows.length
				? rows
						.map((row) => {
							const id = rowId(row)
							const delta = rowDelta(row)
							return `<label class="row"><input type="checkbox" data-program-check="${h(id)}" ${cache.selectedPrograms[id] ? "checked" : ""}><span>Campaign <code>${h(id)}</code><br><span class="muted">onchain</span> ${h(formatBig(rowOnchain(row)))}<br><span class="muted">offchain</span> ${h(formatBig(rowOffchain(row)))}</span><b class="${delta > 0n ? "ok" : delta < 0n ? "warn" : "muted"}">${delta >= 0n ? "+" : ""}${h(formatBig(delta))}</b></label>`
						})
						.join("")
				: `<p class="muted">No outdated point states found.</p>`
		}<h4>Cached vouchers</h4>${
			vouchers.length
				? vouchers
						.map((voucher, index) => {
							const stale = isStale(account, voucher)
							const current = matchesIdsAndCurrentTotals(account, voucher, voucher.programIds || [])
							const selectedExact = exactVoucher?.key === voucher.key
							return `<label class="voucher"><input type="radio" name="sf-voucher-select" value="${h(voucher.key)}" ${cache.selectedVoucherKey === voucher.key ? "checked" : ""}> <b>#${h(index + 1)}</b> <span class="${stale ? "warn" : "ok"}">${stale ? "stale nonce" : "nonce ok/latest"}</span> ${selectedExact ? `<span class="ok">exact selected</span>` : current ? `<span class="ok">current totals</span>` : `<span class="warn">old totals?</span>`}<br>Kind: <code>${h(voucher.kind)}</code><br>Source: <code>${h(voucher.source)}</code><br>Campaigns: <code>${h((voucher.programIds || []).join(", "))}</code><br>Signed units: <code>${h((voucher.totalProgramUnits || []).join(", "))}</code><br>Nonce: <code>${h(voucher.nonce)}</code><br>Saved: <code>${h(voucher.savedAt ? age(voucher.savedAt) : "unknown")}</code><br>Signer: <code>${h(voucher.signer || "unknown")}</code><br>Sig: <code>${h(String(voucher.signature || "").slice(0, 34))}…</code></label>`
						})
						.join("")
				: `<p class="muted">No vouchers cached yet.</p>`
		}<div class="actions"><button class="primary" data-act="arm" ${selectedVoucher ? "" : "disabled"}>Arm selected</button><button class="primary" data-act="arm-click" ${selectedVoucher ? "" : "disabled"}>Arm + click Claim</button><button data-act="disarm">Disarm</button><button data-act="copy" ${selectedVoucher ? "" : "disabled"}>Copy selected response</button><button data-act="export">Export cache</button><button data-act="import">Import cache</button><button class="danger" data-act="clear">Clear account cache</button></div><details><summary>Logs / note</summary><p class="muted">If Arm + click does not increment hits, the app used an already-cached claim transaction instead of calling /api/points/claim. Reload the claim page, run this tool, arm the exact voucher, then click claim.</p><div data-log>${runtime.logs.map((entry) => `<div>${h(entry)}</div>`).join("")}</div></details>`
		return {
			account,
			rows: rows.length,
			vouchers: vouchers.length,
			selected: selectedIds,
			accountSource: runtime.accountSource,
		}
	}

	try {
		installFetchInterceptor()
		ensureUi()
		const initialAccount = await currentAccount({ request: false })
		complete({
			ok: true,
			message: "Superfluid claim voucher tool loaded",
			version: TOOL_VERSION,
			account: initialAccount,
			rows: 0,
			vouchers: accountCache(initialAccount).vouchers.length,
			selected: selectedProgramIdsFor(initialAccount),
			accountSource: runtime.accountSource,
		})
		render({ forceRefresh: false }).catch((error) => {
			log("initial render failed", error)
			const body = $(`#${APP_ID} .body`)
			if (body)
				body.innerHTML = `<p class="err">${h(error.message || String(error))}</p><button data-act="refresh">Retry</button>`
		})
		if (!location.href.startsWith(CLAIM_ORIGIN)) log(`Run this on ${CLAIM_ORIGIN}`)
	} catch (error) {
		complete({ ok: false, message: error?.message || String(error), stack: error?.stack || "" })
	}
})()
