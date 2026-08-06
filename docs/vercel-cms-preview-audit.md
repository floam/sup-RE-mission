# Closed PR Vercel CMS preview audit

Generated: 2026-08-03

Repository: `superfluid-org/superfluid.pro`

Probes:

```text
GET /points/signed-balance?account=0xdBb811EC62338db94858Ec21ef1d56B658111922&campaignId=608
GET /points/signed-balance?account=0xdBb811EC62338db94858Ec21ef1d56B658111922&campaignId=602
```

This audit used public Vercel branch aliases published by the Vercel bot in pull-request comments. It did not use credentials, attempt an authentication bypass, or use a Vercel share link. Duplicate aliases were requested once and mapped back to every pull request that referenced them.

## Summary

| Metric | Count |
|---|---:|
| Closed pull requests | 76 |
| PRs with a CMS preview alias | 71 |
| PRs without a CMS preview alias | 5 |
| Unique CMS aliases | 59 |
| Aliases returning points JSON | 34 |
| Aliases returning `410 GONE` | 21 |
| Aliases returning `404 DEPLOYMENT_NOT_FOUND` | 4 |

All 34 live aliases could read campaign 608 and produce signatures from:

```text
0xB96cb16370c8A9cE54e0d686b8770225a17c43ee
```

That confirms the deployments had runtime access to points data and production-trusted signing material.

### Live response groups

| Campaign | Response | Aliases |
|---|---|---:|
| 608 | `points=0`, `uncappedPoints` absent | 16 |
| 608 | `points=1`, `uncappedPoints=4140000` | 13 |
| 608 | `points=0`, `uncappedPoints=0` | 5 |
| 602 | `points=0`, `uncappedPoints` absent | 16 |
| 602 | `points=0`, `uncappedPoints=0` | 18 |

No live alias returned one point for campaign 602. The same check on 56 live immutable deployment URLs also returned zero points: 22 responses did not have `uncappedPoints`, and 34 returned `uncappedPoints=0`. Thus, this account did not reproduce the suspected capped-zero-to-one error. All 90 live routes still returned a valid signature from the production signer, so the credential exposure remains.

## Difference from the GitHub deployment enumeration

An earlier GitHub deployment enumeration found 18 live CMS deployments. That result used a different Vercel identifier and answered a different question:

- GitHub deployment records expose immutable deployment URLs, while pull-request comments expose branch aliases.
- GitHub returned 408 historical preview records across the CMS, data, MCP-docs, MCP-server, website, and SDK-docs projects.
- An unauthenticated API run sampled the status URLs attached to those records and found 53 HTTP-200 deployments across the combined projects.
- A GitHub deployment can remain marked successful after a branch alias has been removed.
- A branch alias can still route to a deployment even when that alias is not represented by the sampled GitHub records.
- A successful response from `/` only proves that the deployment responds. A signed-balance JSON response proves access to the points data and signer.

For closed-PR CMS risk, the result in this document supersedes the earlier 18-deployment estimate: **34 unique public CMS aliases are live**.

## GitHub deployment records

The GitHub deployment endpoint returned 933 records:

| Environment | Records |
|---|---:|
| Preview CMS | 119 |
| Preview data | 72 |
| Preview MCP docs | 39 |
| Preview MCP server | 39 |
| Preview website | 87 |
| Preview SDK docs | 52 |
| Production CMS | 126 |
| Production data | 48 |
| Production MCP docs | 74 |
| Production MCP server | 74 |
| Production legacy pro docs | 1 |
| Production legacy pro server | 1 |
| Production website | 111 |
| Production SDK docs | 90 |

The Vercel deployment URL is stored in each record's latest deployment status. Because the unauthenticated GitHub API rate limit interrupted the scan, 100 of 119 preview-CMS records were checked:

| Result | Count |
|---|---:|
| GitHub state `success` | 95 |
| GitHub state `failure` | 4 |
| GitHub state `inactive` | 1 |
| Live immutable deployment URL | 56 |
| Removed immutable deployment URL | 39 |
| Not queried because of rate limit | 19 |

The 56 live immutable URLs are therefore a confirmed minimum, not a complete upper bound.

### Live immutable CMS deployment URLs found through GitHub

| Date | Commit | Deployment | Campaign 608 | Campaign 602 |
|---|---|---|---|---|
| 2026-07-09 | `e8a75443` | `superfluid-26a6dwjkk-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-07-09 | `728c32e9` | `superfluid-rhzrabsng-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-07-09 | `3acde390` | `superfluid-1huxkyiob-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-07-02 | `2a3b3e08` | `superfluid-23ldoh858-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-07-01 | `c1ecaf7b` | `superfluid-6e68d70m1-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-07-01 | `98b84294` | `superfluid-798ue31dd-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-07-01 | `852bbc6c` | `superfluid-mi04t7g7f-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-06-22 | `90121dee` | `superfluid-kr4a4wd6h-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-06-22 | `890bba50` | `superfluid-84yi0iprk-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-06-09 | `c2ef2ca9` | `superfluid-8nsx9wcc0-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-06-08 | `5c79963a` | `superfluid-d2a8zvyvr-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-06-08 | `0941ec41` | `superfluid-3nhymz8eq-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-06-08 | `0797f1fb` | `superfluid-n3jvl5hm7-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-05-27 | `1bb5e3fd` | `superfluid-ecaxreat9-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-04-17 | `ecf6f22e` | `superfluid-des51ndk7-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-04-17 | `dfc6d7bc` | `superfluid-eqcdrwbm1-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-04-17 | `989b6229` | `superfluid-kvn6n3bfk-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-04-17 | `7c96c5a8` | `superfluid-gyyjx9znf-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-04-16 | `73a3eb38` | `superfluid-ph6d1jl76-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-04-16 | `2c2c6bc5` | `superfluid-pssz6i9we-superfluid-foundation.vercel.app` | `points=1; uncappedPoints=4140000` | `points=0; uncappedPoints=0` |
| 2026-04-06 | `baf446e6` | `superfluid-mvfvq6t6i-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-04-06 | `612c75a5` | `superfluid-m8t32zp56-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-04-06 | `5eaad79c` | `superfluid-1taulo9q9-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-26 | `ef669263` | `superfluid-da1qd285y-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-26 | `ee8a24b2` | `superfluid-ja9bt2xd3-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-26 | `965fccd9` | `superfluid-ijussg59u-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-26 | `38f1d99a` | `superfluid-a0woe2qnw-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-25 | `c74cc5ef` | `superfluid-n6s6hojri-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-25 | `82ad1db2` | `superfluid-jf6z4ybt1-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-23 | `df38961c` | `superfluid-oookggdcf-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-23 | `ce3c6898` | `superfluid-p6rus88qf-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-23 | `c3f9069e` | `superfluid-46lu3l96l-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-23 | `28ad0255` | `superfluid-31yf7tzb4-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-23 | `1f1c1924` | `superfluid-88t6nta5g-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-23 | `1a4df105` | `superfluid-hyoakhwqu-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-20 | `fada7290` | `superfluid-f9o3lbqen-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-20 | `ee479cf0` | `superfluid-ewanwghel-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-20 | `d1d2175b` | `superfluid-3w3vdkb0v-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-20 | `ca2e200f` | `superfluid-dk6geta0l-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-20 | `c82256e9` | `superfluid-oi89twprx-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-20 | `1a26032a` | `superfluid-lk6izm55k-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-19 | `a4d52aee` | `superfluid-4tubnx0rs-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-13 | `e8953bc3` | `superfluid-3zr93cx02-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-13 | `c5fd1403` | `superfluid-i9dxqhviy-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-11 | `f04db535` | `superfluid-rkho8a46n-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-09 | `171c6571` | `superfluid-6dgftmht2-superfluid-foundation.vercel.app` | `points=0; uncappedPoints=0` | `points=0; uncappedPoints=0` |
| 2026-03-04 | `85416df2` | `superfluid-911baidfx-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-03 | `e97e07e9` | `superfluid-khhr6n3rh-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-03 | `093aaede` | `superfluid-qxsgwghr1-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-02 | `b42d3ab0` | `superfluid-7md9usvly-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-03-02 | `0805a03b` | `superfluid-fg2tpzbgp-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-02-25 | `da9056ea` | `superfluid-fd1tk6fke-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-02-25 | `9b042871` | `superfluid-nso00uy53-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-02-25 | `4730e47a` | `superfluid-dpjeitenq-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-02-18 | `0cd7af41` | `superfluid-8fu2xgwvp-superfluid-foundation.vercel.app` | `points=0` | `points=0` |
| 2026-02-10 | `a57b3bd6` | `superfluid-97va70uf8-superfluid-foundation.vercel.app` | `points=0` | `points=0` |

The 56 immutable deployment URLs are a confirmed minimum from the partially rate-limited GitHub scan. The branch-alias audit remains the complete closed-PR view.

## Pull request coverage

| Pull requests | Result |
|---|---|
| 1, 2 | Vercel comment predates the CMS project |
| 3 | CMS introduced, but the Vercel comment has no CMS row |
| 20, 21 | No Vercel bot comment |
| 4, 5-13, 15, 35 | `404 DEPLOYMENT_NOT_FOUND` |
| 14, 16-19, 22-34, 36-38 | `410 GONE` |
| 39-50, 52-77 | Live points JSON |

Pull request 51 does not exist. Pull requests 5-13 all reference the same CMS alias. Pull requests 46, 53, 70, 74, and 76 all reference the same `changeset-release-main` alias.

## Unique CMS aliases

| # | Pull request(s) | CMS alias | Result for campaign 608 |
|---:|---|---|---|
| 1 | 4 | `superfluid-cms-git-2025-09-28-sdk-0efe24-kaspar-kallas-projects.vercel.app` | `404 DEPLOYMENT_NOT_FOUND` |
| 2 | 14 | `superfluid-cms-git-2025-12-02-points-kaspar-kallas-projects.vercel.app` | `410 GONE` |
| 3 | 15 | `superfluid-cms-git-2025-12-09-upd-04fac5-kaspar-kallas-projects.vercel.app` | `404 DEPLOYMENT_NOT_FOUND` |
| 4 | 36 | `superfluid-cms-git-2026-01-02-add-18c5ae-superfluid-foundation.vercel.app` | `410 GONE` |
| 5 | 35 | `superfluid-cms-git-2026-01-02-fix-d8639e-superfluid-foundation.vercel.app` | `404 DEPLOYMENT_NOT_FOUND` |
| 6 | 16 | `superfluid-cms-git-2026-01-15-add-a47bb3-kaspar-kallas-projects.vercel.app` | `410 GONE` |
| 7 | 17 | `superfluid-cms-git-2026-01-15-fix-ea9632-kaspar-kallas-projects.vercel.app` | `410 GONE` |
| 8 | 18 | `superfluid-cms-git-2026-01-16-add-122afe-superfluid-foundation.vercel.app` | `410 GONE` |
| 9 | 19 | `superfluid-cms-git-2026-01-16-impr-856128-superfluid-foundation.vercel.app` | `410 GONE` |
| 10 | 22 | `superfluid-cms-git-2026-01-21-batc-e14079-superfluid-foundation.vercel.app` | `410 GONE` |
| 11 | 23 | `superfluid-cms-git-2026-01-22-disa-7e4bc1-superfluid-foundation.vercel.app` | `410 GONE` |
| 12 | 25 | `superfluid-cms-git-2026-01-22-disa-91dea1-superfluid-foundation.vercel.app` | `410 GONE` |
| 13 | 24 | `superfluid-cms-git-2026-01-22-unif-b20cf2-superfluid-foundation.vercel.app` | `410 GONE` |
| 14 | 28 | `superfluid-cms-git-2026-01-26-chan-645a55-superfluid-foundation.vercel.app` | `410 GONE` |
| 15 | 29 | `superfluid-cms-git-2026-01-26-feat-4b59c7-superfluid-foundation.vercel.app` | `410 GONE` |
| 16 | 26 | `superfluid-cms-git-2026-01-26-opti-f91816-superfluid-foundation.vercel.app` | `410 GONE` |
| 17 | 27 | `superfluid-cms-git-2026-01-26-update-deps-superfluid-foundation.vercel.app` | `410 GONE` |
| 18 | 30 | `superfluid-cms-git-2026-01-28-camp-4192ca-superfluid-foundation.vercel.app` | `410 GONE` |
| 19 | 34 | `superfluid-cms-git-2026-02-02-update-deps-superfluid-foundation.vercel.app` | `410 GONE` |
| 20 | 38 | `superfluid-cms-git-2026-02-03-opti-fcc040-superfluid-foundation.vercel.app` | `410 GONE` |
| 21 | 37 | `superfluid-cms-git-2026-02-03-sync-ef9924-superfluid-foundation.vercel.app` | `410 GONE` |
| 22 | 39 | `superfluid-cms-git-2026-02-04-fix-b4450e-superfluid-foundation.vercel.app` | `200; points=0` |
| 23 | 40 | `superfluid-cms-git-2026-02-04-opti-1e92de-superfluid-foundation.vercel.app` | `200; points=0` |
| 24 | 43 | `superfluid-cms-git-2026-02-10-disa-59c04f-superfluid-foundation.vercel.app` | `200; points=0` |
| 25 | 44 | `superfluid-cms-git-2026-02-18-update-sdk-superfluid-foundation.vercel.app` | `200; points=0` |
| 26 | 45 | `superfluid-cms-git-2026-03-02-disa-e107c0-superfluid-foundation.vercel.app` | `200; points=0` |
| 27 | 52 | `superfluid-cms-git-2026-03-20-upda-3c0af7-superfluid-foundation.vercel.app` | `200; points=0` |
| 28 | 69 | `superfluid-cms-git-2026-06-03-clear-macro-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 29 | 5-13 | `superfluid-cms-git-changeset-rele-6153af-kaspar-kallas-projects.vercel.app` | `404 DEPLOYMENT_NOT_FOUND` |
| 30 | 46, 53, 70, 74, 76 | `superfluid-cms-git-changeset-release-main-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 31 | 56 | `superfluid-cms-git-chore-npm-trust-cec913-superfluid-foundation.vercel.app` | `200; points=0` |
| 32 | 72 | `superfluid-cms-git-chore-sdk-metad-e0211e-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 33 | 75 | `superfluid-cms-git-chore-sdk-packa-90ab15-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 34 | 54 | `superfluid-cms-git-chore-unpin-dep-b3581b-superfluid-foundation.vercel.app` | `200; points=0` |
| 35 | 47 | `superfluid-cms-git-claude-add-camp-ad7dec-superfluid-foundation.vercel.app` | `200; points=0` |
| 36 | 55 | `superfluid-cms-git-claude-add-poin-8c7be4-superfluid-foundation.vercel.app` | `200; points=0; uncappedPoints=0` |
| 37 | 33 | `superfluid-cms-git-claude-disable-319c23-superfluid-foundation.vercel.app` | `410 GONE` |
| 38 | 31 | `superfluid-cms-git-claude-disable-69bbc4-superfluid-foundation.vercel.app` | `410 GONE` |
| 39 | 32 | `superfluid-cms-git-claude-disable-f45753-superfluid-foundation.vercel.app` | `410 GONE` |
| 40 | 41 | `superfluid-cms-git-claude-remove-g-e2267f-superfluid-foundation.vercel.app` | `200; points=0` |
| 41 | 48 | `superfluid-cms-git-claude-replace-ac477c-superfluid-foundation.vercel.app` | `200; points=0` |
| 42 | 49 | `superfluid-cms-git-claude-update-g-a89654-superfluid-foundation.vercel.app` | `200; points=0` |
| 43 | 58 | `superfluid-cms-git-feat-batch-pricing-api-superfluid-foundation.vercel.app` | `200; points=0` |
| 44 | 42 | `superfluid-cms-git-feat-point-bala-c570c1-superfluid-foundation.vercel.app` | `200; points=0` |
| 45 | 59 | `superfluid-cms-git-feat-points-cam-f4428e-superfluid-foundation.vercel.app` | `200; points=0; uncappedPoints=0` |
| 46 | 73 | `superfluid-cms-git-feat-sdk-testne-ff91f7-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 47 | 71 | `superfluid-cms-git-fix-changeset-p-82daed-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 48 | 61 | `superfluid-cms-git-fix-cms-cors-an-354153-superfluid-foundation.vercel.app` | `200; points=0; uncappedPoints=0` |
| 49 | 62 | `superfluid-cms-git-fix-cms-price-t-bdc1ea-superfluid-foundation.vercel.app` | `200; points=0; uncappedPoints=0` |
| 50 | 65 | `superfluid-cms-git-fix-cms-token-r-b9a4f7-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 51 | 57 | `superfluid-cms-git-fix-npm-trusted-892a14-superfluid-foundation.vercel.app` | `200; points=0` |
| 52 | 64 | `superfluid-cms-git-kasparkallas-ch-0a1041-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 53 | 66 | `superfluid-cms-git-kasparkallas-fe-71e98f-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 54 | 77 | `superfluid-cms-git-kasparkallas-fi-031c4d-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 55 | 63 | `superfluid-cms-git-kasparkallas-pe-28516c-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 56 | 67 | `superfluid-cms-git-kasparkallas-pe-a579a0-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 57 | 68 | `superfluid-cms-git-points-api-perf-superfluid-foundation.vercel.app` | `200; points=1; uncappedPoints=4140000` |
| 58 | 60 | `superfluid-cms-git-refactor-points-b384c7-superfluid-foundation.vercel.app` | `200; points=0; uncappedPoints=0` |
| 59 | 50 | `superfluid-cms-git-vercel-react-se-c0ce06-superfluid-foundation.vercel.app` | `200; points=0` |

## Required remediation

1. Remove every live closed-PR branch alias and its underlying deployment.
2. Remove production database and signing credentials from the Vercel Preview environment.
3. Rotate the signer and any other credential that was exposed to preview deployments.
4. Give previews an isolated database branch and preview-only secrets.
5. Add a startup guard that rejects a production database connection when `VERCEL_ENV=preview`.
