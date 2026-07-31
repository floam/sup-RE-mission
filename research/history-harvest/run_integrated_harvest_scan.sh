#!/usr/bin/env bash
set -Eeuo pipefail
IFS=$'\n\t'

: "${GH_TOKEN:?GH_TOKEN is required}"
: "${RUNNER_TEMP:?RUNNER_TEMP is required}"
: "${GITHUB_RUN_ID:?GITHUB_RUN_ID is required}"

ROOT="${ROOT:-$RUNNER_TEMP/superfluid-org-integrated-history}"
API_CACHE="${API_CACHE:-$RUNNER_TEMP/superfluid-history-api-cache}"
REPORTS="${REPORTS:-$RUNNER_TEMP/superfluid-integrated-scan-reports}"
MAX_FORK_FETCHES="${MAX_FORK_FETCHES:-1500}"
MAX_DETACHED_REMOTE_FETCHES="${MAX_DETACHED_REMOTE_FETCHES:-500}"

mkdir -p \
  "$ROOT/repos" \
  "$ROOT/meta/github" \
  "$ROOT/meta/swh" \
  "$API_CACHE" \
  "$REPORTS/repositories"

python3 research/history-harvest/github_history_harvester.py \
  --org superfluid-org \
  --out "$ROOT/meta/github" \
  --cache "$API_CACHE" \
  --rate-floor 250 \
  --max-fork-depth 6 \
  --max-forks-per-root 5000

{
  cat "$ROOT/meta/github/repositories.txt"
  awk -F '\t' 'NR > 1 && $3 != "" { print $3 }' "$ROOT/meta/github/forks.tsv"
  awk -F '\t' 'NR > 1 && $5 != "" { print $5 }' "$ROOT/meta/github/candidates.tsv"
} | awk 'NF && !seen[tolower($0)]++' > "$ROOT/meta/swh-origins.txt"

python3 research/history-harvest/swh_reference_harvester.py \
  --repositories "$ROOT/meta/swh-origins.txt" \
  --out "$ROOT/meta/swh" \
  --max-requests 400 \
  --delay 0.5 \
  --snapshots-per-origin 20 \
  --max-origins 500 || true

{
  head -n 1 "$ROOT/meta/github/candidates.tsv"
  tail -n +2 "$ROOT/meta/github/candidates.tsv"
  if [ -f "$ROOT/meta/swh/candidates.tsv" ]; then
    tail -n +2 "$ROOT/meta/swh/candidates.tsv"
  fi
} | awk 'NR == 1 || !seen[$0]++' > "$ROOT/meta/candidates.tsv"

cp "$ROOT/meta/github/repositories.txt" "$ROOT/meta/repositories.txt"
date -u +'%Y-%m-%dT%H:%M:%SZ' > "$ROOT/meta/generated-at.txt"
git --version > "$ROOT/meta/git-version.txt"
gitleaks version > "$ROOT/meta/gitleaks-version.txt"

printf 'repository\treachable_commits\tall_objects\tpacked_bytes\n' \
  > "$ROOT/meta/repository-counts.tsv"
printf 'root_repository\tfork_repository\tresult\n' \
  > "$ROOT/meta/fork-fetch-results.tsv"
: > "$ROOT/meta/mirror-errors.log"

while IFS= read -r repo; do
  [ -n "$repo" ] || continue
  name="${repo#*/}"
  dest="$ROOT/repos/${name}.git"

  echo "::group::Mirroring $repo"
  if ! git clone --mirror "https://github.com/${repo}.git" "$dest"; then
    printf '%s\tclone-failed\n' "$repo" >> "$ROOT/meta/mirror-errors.log"
    echo "::endgroup::"
    continue
  fi

  git -C "$dest" fetch origin \
    '+refs/pull/*/head:refs/pull/*/head' \
    '+refs/pull/*/merge:refs/pull/*/merge' \
    '+refs/notes/*:refs/notes/*' \
    --force || true
  echo "::endgroup::"
done < "$ROOT/meta/repositories.txt"

fetched=0
while IFS=$'\t' read -r root parent fork depth clone_url size pushed archived; do
  [ "$root" = "root_repository" ] && continue
  [ -n "$root" ] && [ -n "$fork" ] || continue
  [ "$fetched" -lt "$MAX_FORK_FETCHES" ] || break
  dest="$ROOT/repos/${root#*/}.git"
  [ -d "$dest" ] || continue
  safe="$(printf '%s' "$fork" | tr -c 'A-Za-z0-9._-' '_')"

  if timeout 240s git -C "$dest" fetch --no-tags --force "$clone_url" \
    "+refs/heads/*:refs/recovered/forks/${safe}/heads/*" \
    "+refs/tags/*:refs/recovered/forks/${safe}/tags/*" \
    "+refs/pull/*/head:refs/recovered/forks/${safe}/pull/*/head" \
    "+refs/pull/*/merge:refs/recovered/forks/${safe}/pull/*/merge"; then
    printf '%s\t%s\tok\n' "$root" "$fork" >> "$ROOT/meta/fork-fetch-results.tsv"
  else
    printf '%s\t%s\tfailed\n' "$root" "$fork" >> "$ROOT/meta/fork-fetch-results.tsv"
  fi
  fetched=$((fetched + 1))
done < "$ROOT/meta/github/forks.tsv"

awk -F '\t' 'NR > 1 && $5 != "" { print $1 "\t" $5 }' "$ROOT/meta/candidates.tsv" \
  | sort -u > "$ROOT/meta/detached-remotes.tsv"
detached=0
while IFS=$'\t' read -r root remote; do
  [ -n "$root" ] && [ -n "$remote" ] || continue
  [ "$detached" -lt "$MAX_DETACHED_REMOTE_FETCHES" ] || break

  resolved_root="$root"
  if ! grep -Fxq "$resolved_root" "$ROOT/meta/repositories.txt"; then
    mapped="$(awk -F '\t' -v fork="$resolved_root" 'NR > 1 && $3 == fork { print $1; exit }' "$ROOT/meta/github/forks.tsv")"
    [ -n "$mapped" ] && resolved_root="$mapped"
  fi

  dest="$ROOT/repos/${resolved_root#*/}.git"
  [ -d "$dest" ] || continue
  safe="$(printf '%s' "$remote" | tr -c 'A-Za-z0-9._-' '_')"
  timeout 240s git -C "$dest" fetch --no-tags --force \
    "https://github.com/${remote}.git" \
    "+refs/heads/*:refs/recovered/detached/${safe}/heads/*" \
    "+refs/tags/*:refs/recovered/detached/${safe}/tags/*" \
    "+refs/pull/*/head:refs/recovered/detached/${safe}/pull/*/head" \
    "+refs/pull/*/merge:refs/recovered/detached/${safe}/pull/*/merge" || true
  detached=$((detached + 1))
done < "$ROOT/meta/detached-remotes.tsv"

printf 'repository\tsha\tsource\tresult\tremote_hint\n' \
  > "$ROOT/meta/candidate-fetch-results.tsv"
awk -F '\t' 'NR > 1 { key=$1 FS $2; if (!seen[key]++) print $1 FS $2 FS $3 FS $5 }' \
  "$ROOT/meta/candidates.tsv" > "$ROOT/meta/candidates-unique.tsv"

while IFS=$'\t' read -r repo sha source remote_hint; do
  [ -n "$repo" ] && [ -n "$sha" ] || continue

  resolved_root="$repo"
  if ! grep -Fxq "$resolved_root" "$ROOT/meta/repositories.txt"; then
    mapped="$(awk -F '\t' -v fork="$resolved_root" 'NR > 1 && $3 == fork { print $1; exit }' "$ROOT/meta/github/forks.tsv")"
    [ -n "$mapped" ] && resolved_root="$mapped"
  fi

  dest="$ROOT/repos/${resolved_root#*/}.git"
  if [ ! -d "$dest" ]; then
    printf '%s\t%s\t%s\tno-root-mirror\t%s\n' \
      "$repo" "$sha" "$source" "$remote_hint" \
      >> "$ROOT/meta/candidate-fetch-results.tsv"
    continue
  fi

  if git -C "$dest" cat-file -e "${sha}^{commit}" 2>/dev/null; then
    git -C "$dest" update-ref "refs/recovered/candidates/${sha}" "$sha" || true
    result="already-present"
  elif timeout 60s git -C "$dest" fetch --no-tags origin \
    "${sha}:refs/recovered/candidates/${sha}" 2>/dev/null; then
    result="fetched-origin-by-sha"
  elif [ -n "$remote_hint" ] && timeout 60s git -C "$dest" fetch --no-tags \
    "https://github.com/${remote_hint}.git" \
    "${sha}:refs/recovered/candidates/${sha}" 2>/dev/null; then
    result="fetched-hint-by-sha"
  elif [ "$repo" != "$resolved_root" ] && timeout 60s git -C "$dest" fetch --no-tags \
    "https://github.com/${repo}.git" \
    "${sha}:refs/recovered/candidates/${sha}" 2>/dev/null; then
    result="fetched-repository-by-sha"
  else
    result="not-recovered"
  fi

  printf '%s\t%s\t%s\t%s\t%s\n' \
    "$repo" "$sha" "$source" "$result" "$remote_hint" \
    >> "$ROOT/meta/candidate-fetch-results.tsv"
done < "$ROOT/meta/candidates-unique.tsv"

while IFS= read -r repo; do
  [ -n "$repo" ] || continue
  name="${repo#*/}"
  dest="$ROOT/repos/${name}.git"
  [ -d "$dest" ] || {
    printf '%s\n' "$repo" >> "$REPORTS/missing-mirrors.txt"
    continue
  }

  git -C "$dest" show-ref | sort > "$ROOT/meta/${name}-refs.txt"
  git -C "$dest" fsck --full --no-reflogs > "$ROOT/meta/${name}-fsck.txt" 2>&1 || true
  commits="$(git -C "$dest" rev-list --all --count)"
  objects="$(git -C "$dest" rev-list --all --objects | wc -l | tr -d ' ')"
  bytes="$(du -sb "$dest" | cut -f1)"
  printf '%s\t%s\t%s\t%s\n' "$repo" "$commits" "$objects" "$bytes" \
    >> "$ROOT/meta/repository-counts.tsv"

  echo "::group::Scanning recovered history for $repo"
  raw="$RUNNER_TEMP/${name}.gitleaks.raw.json"
  gitleaks git "$dest" \
    --log-opts="--all" \
    --config research/history-harvest/current-service-gitleaks.toml \
    --report-format json \
    --report-path "$raw" \
    --exit-code 0 \
    --log-level error \
    --no-banner

  python3 research/history-harvest/sanitize_gitleaks_report.py \
    --repository "$repo" \
    --bare "$dest" \
    --raw "$raw" \
    --candidate-fetch-results "$ROOT/meta/candidate-fetch-results.tsv" \
    --output "$REPORTS/repositories/${name}.safe.json"
  rm -f "$raw"
  echo "::endgroup::"
done < "$ROOT/meta/repositories.txt"

python3 research/history-harvest/aggregate_integrated_scan.py \
  --reports "$REPORTS/repositories" \
  --root "$ROOT" \
  --output "$REPORTS" \
  --run-id "$GITHUB_RUN_ID"

printf '%s\n' "$ROOT" > "$REPORTS/workspace-root.txt"
printf '%s\n' "$API_CACHE" > "$REPORTS/api-cache-path.txt"
