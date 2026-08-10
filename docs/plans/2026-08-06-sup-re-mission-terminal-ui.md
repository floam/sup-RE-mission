# SUP Re:Mission terminal UI plan

Date: 2026-08-06
Branch: `design/terminal-claim-client`
PR: #56

## Goal

Replace the reconstructed application's inherited web-dashboard presentation with one coherent terminal-line interface across every route. This is an independent client, not a visual imitation of the recovered claim application.

## Non-negotiable design rules

1. Use one narrow layout at every viewport width. Target about 72–76 characters; do not create a separate wide desktop composition.
2. Use the browser's generic monospace stack. Routine text, headings, values, controls, and navigation use one font size and one line height.
3. Build hierarchy with terminal rendition: plain, bold, dim, italic, reverse video, and standout. Do not use display typography.
4. Remove heroes, cards, tiles, pills, rounded containers, gradients, shadows, decorative borders, and horizontal rules.
5. Put content against the terminal edge. Do not nest visual cards or add progressive indentation.
6. Use green only for positive signed values and selected-state marks. Use red only for negative signed values. Keep ordinary text white. Keep event names dim gray. Use warnings sparingly as standout text.
7. Render controls as command-like text or reverse-video lines, not conventional product buttons.
8. Do not show keyboard instructions. The application remains pointer- and keyboard-accessible through native controls.
9. Do not hide claim information in accordions, drawers, details elements, or "show more" toggles.
10. Do not show event dates on the claim review surface.

## Shared shell

- Remove the recovered stylesheet from the runtime layout.
- Keep a single compact navigation line: product name, primary routes, wallet state.
- Apply the same terminal primitives to `/`, `/claim`, `/apps`, `/governance`, `/leaderboard`, `/liquidity`, `/reserve`, `/reserve-names`, and `/staking`.
- Remove the recovered swap and LI.FI integration rather than carrying that product
  surface into the independent terminal client.
- Apply the same grammar to loading, route-error, global-error, not-found, wallet, governance, liquidity, Reserve deposit, Reserve withdrawal, and Reserve-name interaction states.
- Existing retained-route behavior stays intact; presentation is normalized globally.

## Claim review grammar

Each campaign is a flat sequence of lines:

```text
[✓] ProductClank Mesh
pts +26,000    flow +26 SUP/mo
+12,000 referral completed
 +8,500 campaign task approved
 +5,500 community contribution
2.4% projected pool share
```

Rules:

- The selection mark and campaign name share the first line.
- Point change is left of flow change.
- Event lines immediately follow the campaign metrics and are always visible when evidence is available.
- Event point values keep their sign color; event names are dim gray.
- The final dim italic line is the campaign's projected GDA pool share. It occupies the position previously considered for a reconciliation/checksum line.
- Do not display unsupported rank or percentile claims. Add those only after an authoritative leaderboard/rank source is integrated.
- Capped campaigns show the signed target delta, the flow delta, and a plain-language raw-to-capped line. Incremental event retrieval remains skipped, matching the points-research rules.

## Claim states

- Disconnected: direct connect and address-lookup commands, no hero.
- Reviewing: flat campaign lines and a compact top status line.
- Submitting: replace the action command text in place with signing, confirmation, and refresh status.
- Confirmed: state success only after a successful receipt and refresh.
- Uncertain/stale: use standout warning text, block resubmission, and expose only the read-only refresh command.

## Safety behavior to preserve

- Positive deltas selected by default; decreasing deltas clear by default.
- Explicit exclusions survive post-claim refreshes.
- Signed batches include only selected campaigns.
- Zero-net-flow updates remain claimable.
- Receipt transport failures after submission are indeterminate, not verified failures.
- Stale or uncertain state blocks another transaction until a read-only refresh succeeds.
- Capped CMS targets, not uncapped points, are submitted.
- Pending event explanations use the reviewed state, fresh signed balances, nonce bounds, and bounded newest-first CMS event reconciliation.

## Implementation checklist

- [x] Add this plan.
- [x] Replace shared global design tokens and shell styles.
- [x] Remove recovered runtime CSS from the layout.
- [x] Replace the home route with terminal route lines.
- [x] Flatten the claim experience and remove its hero, cards, summaries, toggles, details, and drawers.
- [x] Auto-load visible pending-event evidence for changed uncapped campaigns.
- [x] Add projected GDA pool share to claim state and render it after event lines.
- [x] Flatten grouped event rendering and remove dates.
- [x] Replace campaign summary cards and the campaigns table with lines.
- [x] Replace governance, Reserve, Reserve Names, leaderboard, liquidity, and staking route chrome.
- [x] Remove the swap route, its home-route entry, LI.FI configuration, and LI.FI dependency.
- [x] Replace delegate, liquidity-position, withdrawn-stream, Reserve-action, Reserve-deposit, and Reserve-withdrawal cards and modals.
- [x] Remove runtime illustrations, icon-only controls, decorative avatars, and confetti from converted routes and dialogs.
- [x] Replace shared transaction spinners with terminal status text.
- [x] Replace wallet, loading, error, and not-found surfaces.
- [x] Confirm the implementation-head Vercel production build.
- [x] Review all public route responses on the implementation-head preview.
- [ ] Perform a final 320 CSS pixel visual pass in a browser.

## Verification record

- Implementation commit `824e731` built and deployed successfully on Vercel.
- Historical deployment verification covered the public route set that existed at the
  time. The intentionally removed swap surface is not part of the final route inventory.
- Unknown-route verification reached the custom terminal not-found surface.
- The returned route markup uses the shared terminal shell and the converted route-specific line layouts. The claim response contains the compact status/connect surface with no hero or card wrapper.
- A true 320 CSS pixel screenshot review remains open because the execution environment blocked browser navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. HTTP/deployment verification succeeded, but it is not a substitute for that visual pass.
- The commit updating this verification record is documentation-only; it does not change the verified runtime implementation.

## Acceptance criteria

- No route visually resembles the old green dashboard UI.
- No first-party interaction state restores cards, gradients, rounded modal panels, illustrations, or confetti.
- No claim information requires expansion.
- Campaign names scan vertically on the left.
- Point and flow changes read as one line, in that order.
- Events visibly comprise each update without dates.
- The interface remains usable at 320 CSS pixels without switching to a different information architecture.
- Transaction safety semantics from PR #55 and the points-research skill remain unchanged.
