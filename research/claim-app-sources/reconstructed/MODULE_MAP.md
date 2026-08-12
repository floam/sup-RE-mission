# Canonical module and symbol table

This is the global identity ledger for the reconstruction. Each durable symbol has
one owning module. Route-default components are named here even though their source
export is `default`; `app/page.tsx` deliberately re-exports the canonical
`ClaimPage` identity rather than defining a second component. File-private rendering
helpers belong only to their listed owner and are not global aliases.

Source labels:

- **Catalog** — a Sentry source filename names the module.
- **Behavior** — the identity or behavior is present in the recovered webpack
  factory. Important factory IDs are included inline.
- **RSC** — a route shell is present in the Next.js server-component payload.
- **HAR** — an exact request/React Flight response is present in the supplied
  same-deployment capture.
- **Action** — a live stable-ID action result was reconciled with its public data
  source.
- **Inferred** — the human-readable boundary or type name is semantic inference.
- **External** — generated/framework/third-party implementation remains a dependency.

## Routes

| Canonical module             | Canonical identities     | Source                            |
| ---------------------------- | ------------------------ | ----------------------------------- |
| `app/page.tsx`               | re-export of `ClaimPage` | RSC; canonical alias only           |
| `app/apps/page.tsx`          | `CampaignsPage`          | RSC + route factories               |
| `app/claim/page.tsx`         | `ClaimPage`              | RSC + webpack claim chunk           |
| `app/global-error.tsx`       | `GlobalError`            | Catalog + route chunk               |
| `app/governance/page.tsx`    | `GovernancePage`         | RSC + webpack 6031                  |
| `app/layout.tsx`             | `RootLayout`             | RSC + layout chunk                  |
| `app/leaderboard/page.tsx`   | `LeaderboardPage`        | RSC + route chunk                   |
| `app/liquidity/page.tsx`     | `LiquidityPage`          | RSC + route chunk                   |
| `app/reserve/page.tsx`       | `ReservePage`            | RSC + route chunk                   |
| `app/reserve-names/page.tsx` | `ReserveNamesPage`       | RSC + route chunk 6988              |
| `app/staking/page.tsx`       | `StakingPage`            | RSC + webpack 74163                 |

## Shared and campaign components

| Canonical module                                     | Canonical identities                                                                                                                           | Source                    |
| ---------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| `components/ComponentResetWhenAccountChanges.tsx`    | `ComponentResetWhenAccountChanges`                                                                                                             | Behavior 67455              |
| `components/ErrorBoundary.tsx`                       | `ErrorBoundary`                                                                                                                                | Behavior                    |
| `components/FilteredFluidApps.tsx`                   | `FilteredFluidApps`                                                                                                                            | Catalog + claim chunk       |
| `components/FlowingBalance.tsx`                      | `FlowingBalanceProps`, `FlowingBalance`                                                                                                        | Catalog + behavior 48161    |
| `components/FluidAppCard.tsx`                        | `FluidAppCard`                                                                                                                                 | Catalog + behavior 22448    |
| `components/FluidApps.tsx`                           | `FluidApps`                                                                                                                                    | Catalog + behavior 22448    |
| `components/FormattedBalance.tsx`                    | `FormattedBalanceProps`, `FormattedBalance`                                                                                                    | Catalog + behavior 38963    |
| `components/SeasonFilter.tsx`                        | `SEASON_FILTERS`, `SeasonFilterValue`, `isOngoingProgram`, `getDefaultSeasonFilter`, `filterAppsBySeason`, `SeasonFilterProps`, `SeasonFilter` | Catalog + behavior 5104     |
| `components/SignUpToParticipateButton.tsx`           | `SignUpToParticipateButton`                                                                                                                    | Catalog + behavior 1182     |
| `components/TokenIcon.tsx`                           | `TokenIcon`                                                                                                                                    | Behavior; inferred boundary |
| `components/TransactionButton.tsx`                   | `TransactionButtonProps`, `TransactionButton`                                                                                                  | Catalog + behavior 30557    |
| `components/apps/AppOnboardingModal.tsx`             | `APP_ONBOARDING_CONFIG`, `AppOnboardingModal`                                                                                                  | Catalog + behavior 21772    |
| `components/apps/AppOptionsModal.tsx`                | `AppModalProvider`                                                                                                                             | Catalog + behavior 12373    |
| `components/apps/AppsList.tsx`                       | `CategoryDelimiter`, `AppsList`                                                                                                                | Catalog + behavior 96018    |
| `components/apps/FilteredAppsList.tsx`               | `FilteredAppsList`                                                                                                                             | Catalog + behavior 96018    |
| `components/apps/ProgramAppCard.tsx`                 | `ProgramAppCardProps`, `ProgramAppCard`                                                                                                        | Catalog + behavior 50630    |
| `components/campaign/BonusModal.tsx`                 | `BonusModal`                                                                                                                                   | Catalog + behavior 327      |
| `components/campaign/CampaignProgress.tsx`           | `CampaignProgress`                                                                                                                             | Catalog + behavior 327      |
| `components/campaign/CampaignRecommendationStep.tsx` | `CampaignRecommendationStep`                                                                                                                   | Catalog + behavior 85997    |
| `components/campaign/DailyMysteryBoxModal.tsx`       | `ACTIVITY_TIERS`, `getActivityTier`, `DailyMysteryBoxModal`                                                                                    | Catalog + behavior 327      |
| `components/claim/ClaimSection.tsx`                  | `ClaimSection`                                                                                                                                 | Catalog + behavior 85997    |
| `components/claim/Countdown.tsx`                     | `Countdown`                                                                                                                                    | Catalog + behavior 85997    |

## Governance, layout, leaderboard, reserve, liquidity, and staking components

| Canonical module                                    | Canonical identities                           | Source                                           |
| --------------------------------------------------- | ---------------------------------------------- | -------------------------------------------------- |
| `components/governance/ConnectedHideGuard.tsx`      | `ConnectedHideGuard`                           | Catalog + behavior 73873                           |
| `components/governance/DelegateAvatar.tsx`          | `DelegateAvatar`                               | Catalog + behavior 85997                           |
| `components/governance/DelegateStep.tsx`            | `DelegateStepper`, `DelegateStep`              | Behavior 85997; boundary inferred from export `Ux` |
| `components/governance/EditDelegateButton.tsx`      | `EditDelegateButton`                           | Catalog + behavior 82872                           |
| `components/governance/TotalDelegated.tsx`          | `TotalDelegated`                               | Catalog + behavior 65610                           |
| `components/governance/TotalMembers.tsx`            | `TotalMembers`                                 | Catalog + behavior 55078                           |
| `components/governance/YourDelegate.tsx`            | `YourDelegate`                                 | Catalog + behavior 369                             |
| `components/governance/YourVotingPower.tsx`         | `YourVotingPower`                              | Catalog + behavior 84988                           |
| `components/layout/ConnectButton.tsx`               | `ConnectButton`                                | Catalog + layout chunk                             |
| `components/layout/LoadingText.tsx`                 | `LoadingText`                                  | Catalog + behavior 74666                           |
| `components/layout/NavBar.tsx`                      | `NavigationItem`, `NAVIGATION_ITEMS`, `NavBar` | Catalog + layout chunk                             |
| `components/layout/NavConnectAndBalance.tsx`        | `NavConnectAndBalance`                         | Catalog + layout chunk                             |
| `components/layout/NavLink.tsx`                     | `NavLink`                                      | Catalog + layout chunk                             |
| `components/layout/OneTimeBanner.tsx`               | `OneTimeBanner`                                | Catalog + layout chunk                             |
| `components/layout/VotingBanner.tsx`                | `VotingBanner`                                 | Catalog + layout chunk                             |
| `components/leaderboard/Leaderboard.tsx`            | `Leaderboard`                                  | Catalog + behavior 70251                           |
| `components/leaderboard/LeaderboardEntryCard.tsx`   | `LeaderboardEntryCard`                         | Catalog + behavior 70251                           |
| `components/reserve/AnimateOnUpdate.tsx`            | `AnimateOnUpdate`                              | Catalog + reserve chunk                            |
| `components/reserve/CreateReserveSection.tsx`       | `RewardStats`, `CreateReserveSection`          | Catalog + reserve chunk                            |
| `components/reserve/DepositToReserveDialog.tsx`     | `DepositToReserveDialog`                       | Catalog + behavior 30797                           |
| `components/reserve/EnsSection.tsx`                 | `EnsSection`                                   | Catalog + behavior 1125                            |
| `components/reserve/FontaineListItem.tsx`           | `Fontaine`, `FontaineListItem`                 | Catalog + reserve chunk                            |
| `components/reserve/ReserveActionsDropdown.tsx`     | `ReserveActionsDropdown`                       | Catalog + reserve chunk                            |
| `components/reserve/WithdrawFromReserveDialog.tsx`  | `WithdrawFromReserveDialog`                    | Catalog + behavior 30797                           |
| `components/liquidity/AddLiquidityButton.tsx`       | `AddLiquidityButton`                           | Catalog + liquidity chunk                          |
| `components/liquidity/AddLiquidityDialog.tsx`       | `AddLiquidityDialog`                           | Catalog + behavior 21246                           |
| `components/liquidity/LiquidityFeature.tsx`         | `LiquidityFeature`                             | Catalog + liquidity chunk                          |
| `components/liquidity/LiquidityPoolComposition.tsx` | `LiquidityPoolComposition`                     | Catalog + liquidity chunk                          |
| `components/liquidity/LiquidityStats.tsx`           | `calculatePoolUsdMetrics`, `LiquidityStats`    | Catalog + liquidity chunk                          |
| `components/liquidity/WithdrawPositionListItem.tsx` | `WithdrawPositionListItem`                     | Catalog + liquidity chunk                          |
| `components/staking/GenesisNftCard.tsx`             | `GenesisNftCard`                               | Catalog + behavior 74163                           |

## Configuration, contexts, and contracts

| Canonical module                      | Canonical identities                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Source                                                                |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `config/wallet.ts`                    | Base-only Wagmi configuration and injected, Coinbase, WalletConnect, and Safe connectors                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Locally simplified from behaviors 47648, 87389                          |
| `config/chains.ts`                    | `APP_CHAIN`, `BASE_CHAIN_ID`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Base-only simplification of behavior 27765                              |
| `config/governance.ts`                | `SNAPSHOT_SPACE_BY_CHAIN`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Behavior 55711                                                          |
| `contexts/WalletDialogContext.tsx`    | `WalletDialogProvider`, `useWalletDialog`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Local replacement for the recovered AppKit account modal                |
| `contexts/FarcasterFrameProvider.tsx` | `FarcasterFrameProvider`, `useFarcasterFrame`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Catalog + behavior 98452                                                |
| `contexts/LockerContext.tsx`          | `LockerProvider`, `useLocker`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Catalog + behavior 54723                                                |
| `contracts/app-contracts.ts`          | `FLUID_LOCKER_FACTORY_ADDRESS`, `PROGRAM_MANAGER_ADDRESS`, `DELEGATE_MANAGER_ADDRESS`, `MYSTERY_BOX_ADDRESS`, `NONFUNGIBLE_POSITION_MANAGER_ADDRESS`, `ETH_SUP_POOL_ADDRESS`, `TAX_DISTRIBUTION_POOL_ADDRESS`, `LP_DISTRIBUTION_POOL_ADDRESS`, `RESERVE_NAME_REGISTRAR_ADDRESS`, `WETH_ADDRESS`, `SUP_TOKEN_ADDRESS_BY_CHAIN`, `NATIVE_TOKEN_ADDRESS`, `ZERO_ADDRESS`, `UNLOCKING_FEE`, `MIN_UNLOCK_AMOUNT`, `MIN_UNLOCK_DAYS`, `MAX_UNLOCK_DAYS`, `delegateManagerAbi`, `mysteryBoxAbi`, `reserveNameRegistrarAbi`, `uniswapV3PoolAbi`, `nonfungiblePositionManagerAbi`, `MAX_UINT128` | Behavior 67574, 88178, 45537; Action; protocol-wide ABI bodies External |

## Static data and server actions

| Canonical module                  | Canonical identities                                                                              | Source                                        |
| --------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `data/program-app-definitions.ts` | `PROGRAM_APP_DEFINITIONS`                                                                         | HAR `getProgramApps`; boundary inferred         |
| `server-actions/programs.ts`      | `getProgramApps`, `getProgramPoolInfos`                                                           | HAR + Action + contract/subgraph reconciliation |
| `server-actions/stats.ts`         | `getStakingStats`, `getLiquidityPoolStats`, `getLiquidityRewardsStats`, `getTotalDelegatedAmount` | Action + public API/subgraph reconciliation     |

## Hooks

| Canonical module                          | Canonical identities                                                                                                                                                                    | Source                              |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `hooks/useAccumulatedLiquidityRewards.ts` | `useAccumulatedLiquidityRewards`                                                                                                                                                        | Behavior + inferred boundary          |
| `hooks/useAccumulatedStakingRewards.ts`   | `useAccumulatedStakingRewards`                                                                                                                                                          | Behavior + inferred boundary          |
| `hooks/useAddressProfile.ts`              | `useAddressProfile`                                                                                                                                                                     | Behavior 20099                        |
| `hooks/useBonusFlows.ts`                  | `checkBonusFlows`, `claimBonusFlows`                                                                                                                                                    | Behavior 327                          |
| `hooks/useClaimFlowMetrics.ts`            | `calculateClaimFlowRates`, `useClaimFlowMetrics`                                                                                                                                        | Behavior 13175 + HAR action transport |
| `hooks/useClaimTransaction.ts`            | `PointStateResponse`, `ClaimResponse`, `ClaimCall`, `useAccountProgramPointStates`, `useAccountPointClaim`, `buildClaimCall`, `useClaimTransaction`                                     | Behavior 91666                        |
| `hooks/useCreateLocker.ts`                | `useCreateLocker`                                                                                                                                                                       | Behavior 97929                        |
| `hooks/useDebouncedValue.ts`              | `useDebouncedValue`                                                                                                                                                                     | Behavior; inferred reusable boundary  |
| `hooks/useDelegateTransactions.ts`        | `useClearDelegate`, `useSetDelegate`                                                                                                                                                    | Behavior 18351, 85997                 |
| `hooks/useDelegation.ts`                  | `useDelegates`, `useDelegatedAmount`, `useCurrentDelegate`                                                                                                                              | Behavior 37730, 18466, 27734          |
| `hooks/useDepositToReserve.ts`            | `useDepositToReserve`                                                                                                                                                                   | Behavior reserve chunk                |
| `hooks/useFontaines.ts`                   | `useFontaines`                                                                                                                                                                          | Behavior reserve chunk                |
| `hooks/useLeaderboardEntry.ts`            | `useLeaderboardEntry`                                                                                                                                                                   | Behavior 14504                        |
| `hooks/useLiquidityPosition.ts`           | `useLiquidityPosition`, `useEthSupPool`                                                                                                                                                 | Behavior liquidity chunk              |
| `hooks/useLiquidityPositions.ts`          | `useActiveLiquidityPositions`                                                                                                                                                           | Behavior liquidity chunk              |
| `hooks/useLiquidityTransactions.ts`       | `useProvideLiquidity`, `useWithdrawLiquidity`, `useCollectFees`                                                                                                                         | Behavior liquidity chunk              |
| `hooks/useLockerBalance.ts`               | `useLockerBalance`                                                                                                                                                                      | Behavior 4679                         |
| `hooks/useLockerLiquidityBalance.ts`      | `LockerLiquidityBalance`, `useLockerLiquidityBalance`                                                                                                                                   | Behavior 38760                        |
| `hooks/useLockerUnlock.ts`                | `useLockerUnlock`                                                                                                                                                                       | Behavior reserve chunk                |
| `hooks/useMysteryBox.ts`                  | `MYSTERY_BOX_CLAIM_COST`, `MYSTERY_BOX_PENDING_CLAIM_KEY`, `checkMysteryBox`, `claimMysteryBoxPoints`, `readPendingMysteryBoxClaim`, `writePendingMysteryBoxClaim`, `useMysteryBoxOpen` | Behavior 327                          |
| `hooks/useProgramApps.ts`                 | `useProgramApps`                                                                                                                                                                        | Behavior 69515 + HAR action transport |
| `hooks/useProgramBalance.ts`              | `UseProgramBalanceOptions`, `useProgramBalance`                                                                                                                                         | Behavior 22448                        |
| `hooks/useProgramTotalFlowRate.ts`        | `useProgramTotalFlowRate`                                                                                                                                                               | Behavior 22448                        |
| `hooks/useRecentTransactions.ts`          | `recordRecentTransaction`, `useRecentTransactions`                                                                                                                                      | Behavior 84171                        |
| `hooks/useReserveNameRegistration.ts`     | `getReserveNameFee`, `validateReserveSubdomain`, `useReserveNameRegistration`                                                                                                           | Behavior 45537                        |
| `hooks/useStakingTransactions.ts`         | `useLockerStake`, `useLockerUnstake`                                                                                                                                                    | Behavior 74163                        |
| `hooks/useTokenPrices.ts`                 | `useTokenPrice`, `useEthPrice`                                                                                                                                                          | Behavior 29205                        |
| `hooks/useTransactionStatus.ts`           | `useLogTransactionErrors`, `getTransactionStatus`                                                                                                                                       | Behavior 28250, 30335                 |
| `hooks/useWalletAccount.ts`               | `useWalletAccount`                                                                                                                                                                      | Behavior 32224                        |

## Libraries, providers, and types

| Canonical module                        | Canonical identities                                                                                                                                                                                        | Source                                        |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| `lib/endpoints.ts`                      | `API_ENDPOINTS`, `EXTERNAL_ENDPOINTS`                                                                                                                                                                       | Behavior; centralized inferred boundary         |
| `lib/graphql.ts`                        | `GraphQLRequestOptions`, `queryGraphQL`                                                                                                                                                                     | Server action query behavior; boundary inferred |
| `lib/format.ts`                         | `SUP_SYMBOL`, `SECONDS_PER_MONTH`, `formatTokenAmount`, `formatCompactTokenAmount`, `formatMonthlyFlowRate`, `parseTokenAmount`, `sanitizeTokenInput`, `inferDecimalPlaces`, `truncateAddress`, `formatUsd` | Behavior 5663, 63086, 84736; boundary inferred  |
| `lib/liquidity-math.ts`                 | `LiquidityInputToken`, `calculateCorrespondingLiquidityAmount`                                                                                                                                              | Behavior liquidity chunk                        |
| `providers/AnalyticsProvider.tsx`       | `getAnalyticsBrowser`, `AnalyticsProvider`                                                                                                                                                                  | Catalog + behavior 80924                        |
| `providers/AutoConnectFarcaster.tsx`    | `AutoConnectFarcaster`                                                                                                                                                                                      | Behavior layout/providers chunk                 |
| `providers/BonusModalProvider.tsx`      | `BonusModalProvider`                                                                                                                                                                                        | Catalog + behavior 327                          |
| `providers/DailyMysteryBoxProvider.tsx` | `useDailyMysteryBox`, `DailyMysteryBoxProvider`                                                                                                                                                             | Catalog + behavior 327                          |
| `providers/GoodDollarProvider.tsx`      | `GoodDollarProvider`                                                                                                                                                                                        | Behavior providers chunk                        |
| `providers/ReferralHandler.tsx`         | `ReferralHandler`                                                                                                                                                                                           | Behavior providers chunk                        |
| `providers/index.tsx`                   | `getQueryClient`, `ContextProvider`                                                                                                                                                                         | Catalog (`index.tsx`) + behavior 327            |
| `types/campaign-rewards.ts`             | `ActivityTier`, `MysteryBoxCheck`, `MysteryBoxResult`, `PendingMysteryBoxClaim`, `DailyMysteryBoxState`, `BonusCheck`, `BonusClaimResult`                                                                   | Inferred from behavior 327                      |
| `types/governance.ts`                   | `DelegateProfile`, `SnapshotSpace`                                                                                                                                                                          | Inferred from behavior 37730, 55711             |
| `types/liquidity.ts`                    | `LiquidityPoolStats`, `SerializedLiquidityRewardStats`, `LiquidityRewardStats`, `deserializeLiquidityRewardStats`, `LiquidityPositionView`                                                                  | HAR/Action shapes + liquidity behavior          |
| `types/program-app.ts`                  | `Address`, `ProgramOnchainInfo`, `ClaimProgram`, `ProgramApp`, `ProgramAppDefinition`, `ProgramBalance`, `ProgramPoolInfo`, `AddressProfile`, `LeaderboardEntry`                                            | HAR + Zod schema 69515 and consumers            |
| `types/staking.ts`                      | `SerializedStakingStats`, `StakingStats`, `deserializeStakingStats`                                                                                                                                         | Action shape + staking behavior                 |
| `types/transactions.ts`                 | `TransactionStatus`, `ClaimTransaction`, `ProgramPointState`, `RecentTransaction`                                                                                                                           | Inferred from behavior 30335, 91666, 84171      |

Third-party UI primitives named by Sentry (`badge`, `dialog`, `drawer`,
`pagination`, `responsive-dialog`, `sheet`, and `skeleton`) are intentionally not
assigned first-party canonical identities. They remain dependency-owned boilerplate.
