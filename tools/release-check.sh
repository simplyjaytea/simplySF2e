#!/usr/bin/env bash
# One-command "is main shippable?" check. Reruns, in order, the checks the
# release-readiness review did by hand on v0.0.49:
#
#   1. syntax        node --check on every scripts/**/*.mjs (same set as CI)
#   2. tests         every scripts/**/*.test.mjs (same loop as CI)
#   3. manifests     module.json and lang/en.json parse, with no duplicate keys
#   4. references    every esmodule, style and language path in module.json,
#                    and every templates/*.hbs path a script names, is
#                    committed under a folder the release zip ships
#   5. leftovers     no merge-conflict markers in any tracked file
#   6. qa-rows       no duplicate row ids in docs/qa-checklist.md
#   7. whitespace    git diff --check against origin/main (CI fails on this)
#   8. ui            the UI preview harness renders every fixture at both
#                    widths (tools/ui-preview, npm ci + npm run shoot)
#
# Every check runs even after one fails; the script prints a summary and exits
# non-zero if any check failed. It changes nothing in the repo except
# tools/ui-preview/node_modules and tools/ui-preview/out (both gitignored).
#
# Usage: tools/release-check.sh [--no-ui] [--base <ref>]
#   --no-ui        skip the UI harness (it needs npm and Chromium)
#   --base <ref>   ref for the whitespace check (default origin/main;
#                  run git fetch origin main first so it is current)
#
# Live Foundry behaviour is not covered: run docs/qa-checklist.md for that.

set -uo pipefail

if (( BASH_VERSINFO[0] < 4 || (BASH_VERSINFO[0] == 4 && BASH_VERSINFO[1] < 4) )); then
  echo "release-check needs bash 4.4 or later (on macOS: brew install bash)" >&2
  exit 2
fi

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 2

RUN_UI=1
BASE_REF="origin/main"
while (( $# )); do
  case "$1" in
    --no-ui) RUN_UI=0 ;;
    --base)
      if (( $# < 2 )); then echo "--base needs a ref" >&2; exit 2; fi
      BASE_REF="$2"; shift ;;
    -h|--help) sed -n '2,27p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1 (try --help)" >&2; exit 2 ;;
  esac
  shift
done

declare -a RESULTS=()
FAILED=0
LOG_DIR="$(mktemp -d)"
trap 'rm -rf "$LOG_DIR"' EXIT

pass() { RESULTS+=("PASS  $1  $2"); echo "  PASS: $2"; }
fail() { RESULTS+=("FAIL  $1  $2"); FAILED=1; echo "  FAIL: $2"; }
skip() { RESULTS+=("SKIP  $1  $2"); echo "  SKIP: $2"; }
section() { echo; echo "== $1"; }

echo "simplySF2e release check"
echo "  commit: $(git rev-parse --short HEAD 2>/dev/null) on $(git rev-parse --abbrev-ref HEAD 2>/dev/null)"
if [[ -n "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]]; then
  echo "  note: uncommitted changes to tracked files; results describe the working tree, not the commit"
fi

# 1. syntax ------------------------------------------------------------------
section "syntax"
mapfile -d '' MJS < <(find scripts -type f -name '*.mjs' -print0 | sort -z)
bad=0
for f in "${MJS[@]}"; do
  if ! node --check "$f" 2>"$LOG_DIR/check.err"; then
    echo "  $f:"; sed 's/^/    /' "$LOG_DIR/check.err"; bad=$((bad + 1))
  fi
done
if (( ${#MJS[@]} == 0 )); then fail syntax "no .mjs files under scripts/"
elif (( bad )); then fail syntax "$bad of ${#MJS[@]} files fail node --check"
else pass syntax "${#MJS[@]} files pass node --check"; fi

# 2. tests -------------------------------------------------------------------
section "tests"
mapfile -d '' TESTS < <(find scripts -type f -name '*.test.mjs' -print0 | sort -z)
declare -a FAILED_TESTS=()
for t in "${TESTS[@]}"; do
  if ! node "$t" >"$LOG_DIR/test.out" 2>&1; then
    FAILED_TESTS+=("$t")
    echo "  $t failed:"; tail -n 20 "$LOG_DIR/test.out" | sed 's/^/    /'
  fi
done
if (( ${#TESTS[@]} == 0 )); then fail tests "no *.test.mjs under scripts/"
elif (( ${#FAILED_TESTS[@]} )); then fail tests "${#FAILED_TESTS[@]} of ${#TESTS[@]} regression tests fail: ${FAILED_TESTS[*]}"
else pass tests "${#TESTS[@]} regression tests pass"; fi

# 3. manifests ---------------------------------------------------------------
# JSON.parse keeps the last of two equal keys silently, so walk the text.
section "manifests"
if node --input-type=module - module.json lang/en.json <<'NODE'
import { readFileSync } from "node:fs";

function duplicateKeys(text) {
  const dups = [];
  const stack = []; // one entry per open object: { keys: Set, path }
  let i = 0;
  let lastString = null;
  const readString = () => {
    let out = "";
    i++; // opening quote
    while (i < text.length && text[i] !== '"') {
      if (text[i] === "\\") { out += text[i] + text[i + 1]; i += 2; continue; }
      out += text[i++];
    }
    i++; // closing quote
    return JSON.parse(`"${out}"`);
  };
  while (i < text.length) {
    const c = text[i];
    if (c === '"') { lastString = readString(); continue; }
    if (c === "{") { stack.push({ keys: new Set(), key: null }); i++; continue; }
    if (c === "[") { stack.push(null); i++; continue; }
    if (c === "}" || c === "]") { stack.pop(); i++; continue; }
    if (c === ":") {
      const top = stack.at(-1);
      if (top) {
        const where = stack.slice(0, -1).filter(Boolean).map((s) => s.key);
        if (top.keys.has(lastString)) dups.push([...where, lastString].join("."));
        top.keys.add(lastString);
        top.key = lastString;
      }
      i++; continue;
    }
    i++;
  }
  return dups;
}

let bad = false;
for (const file of process.argv.slice(2)) {
  const text = readFileSync(file, "utf8");
  try { JSON.parse(text); } catch (err) { console.log(`  ${file}: does not parse: ${err.message}`); bad = true; continue; }
  const dups = duplicateKeys(text);
  if (dups.length) { bad = true; console.log(`  ${file}: duplicate keys: ${dups.join(", ")}`); }
}
process.exit(bad ? 1 : 0);
NODE
then pass manifests "module.json and lang/en.json parse with no duplicate keys"
else fail manifests "module.json or lang/en.json is invalid or has duplicate keys"; fi

# 4. references --------------------------------------------------------------
section "references"
missing=()
mapfile -t MANIFEST_PATHS < <(node -e '
  const m = JSON.parse(require("fs").readFileSync("module.json", "utf8"));
  for (const p of [...(m.esmodules ?? []), ...(m.scripts ?? []), ...(m.styles ?? []), ...(m.languages ?? []).map((l) => l.path)]) console.log(p);
')
mapfile -t TEMPLATE_PATHS < <(grep -rhoE 'templates/[A-Za-z0-9_./-]+\.hbs' scripts --include='*.mjs' --exclude='*.test.mjs' | sort -u)
# The release zip is built from the commit and ships only these folders
# (release.yml), so a file that exists on disk but is untracked, or lives
# elsewhere, is still missing from the release.
for p in "${MANIFEST_PATHS[@]}" "${TEMPLATE_PATHS[@]}"; do
  if [[ ! "$p" =~ ^(lang|scripts|styles|templates)/ ]] || ! git ls-files --error-unmatch -- "$p" >/dev/null 2>&1; then
    missing+=("$p")
  fi
done
if (( ${#MANIFEST_PATHS[@]} == 0 )); then fail references "module.json lists no esmodules, styles or languages"
elif (( ${#missing[@]} )); then fail references "not committed under lang/, scripts/, styles/ or templates/: ${missing[*]}"
else pass references "${#MANIFEST_PATHS[@]} manifest paths and ${#TEMPLATE_PATHS[@]} template paths are committed"; fi

# 5. leftovers ---------------------------------------------------------------
section "leftovers"
# A lone ======= also matches a setext heading underline of exactly seven;
# none exist, so a hit is worth a look either way.
git grep -nE '^(<{7}|>{7}|\|{7}|={7})( |$)' -- . >"$LOG_DIR/markers" 2>"$LOG_DIR/markers.err"
rc=$?
if (( rc == 0 )); then
  sed 's/^/    /' "$LOG_DIR/markers"
  fail leftovers "$(wc -l <"$LOG_DIR/markers") merge-conflict marker lines in tracked files"
elif (( rc == 1 )); then
  pass leftovers "no merge-conflict markers in tracked files"
else
  sed 's/^/    /' "$LOG_DIR/markers.err"
  fail leftovers "git grep failed (exit $rc)"
fi

# 6. qa-rows -----------------------------------------------------------------
section "qa-rows"
QA=docs/qa-checklist.md
if [[ ! -f "$QA" ]]; then
  fail qa-rows "$QA is missing"
else
  rows=$(awk -F'|' '/^\|[[:space:]]*[0-9]+[a-z]*\.[0-9]+[[:space:]]*\|/ { gsub(/[[:space:]]/, "", $2); print $2 }' "$QA")
  count=$(grep -c . <<<"$rows")
  dups=$(sort <<<"$rows" | uniq -d | paste -sd' ')
  if [[ -n "$dups" ]]; then fail qa-rows "duplicate QA row ids: $dups"
  elif (( count == 0 )); then fail qa-rows "no QA rows found in $QA (has the table format changed?)"
  else pass qa-rows "$count QA row ids, all unique"; fi
fi

# 7. whitespace --------------------------------------------------------------
section "whitespace"
if ! git rev-parse --verify --quiet "$BASE_REF^{commit}" >/dev/null; then
  fail whitespace "base ref $BASE_REF not found (git fetch origin main, or pass --base)"
elif [[ "$(git rev-parse HEAD)" == "$(git rev-parse "$BASE_REF^{commit}")" && -z "$(git status --porcelain --untracked-files=no)" ]]; then
  skip whitespace "HEAD is $BASE_REF with no local changes; nothing to compare"
elif out=$(git diff --check "$BASE_REF" -- 2>&1); [[ -n "$out" ]]; then
  sed 's/^/    /' <<<"$out" | head -n 40
  fail whitespace "git diff --check against $BASE_REF reports whitespace errors"
else
  pass whitespace "git diff --check against $BASE_REF is clean"
fi

# 8. ui ----------------------------------------------------------------------
section "ui"
if (( ! RUN_UI )); then
  skip ui "UI harness skipped (--no-ui)"
elif ! (cd tools/ui-preview && npm ci --no-audit --no-fund --loglevel=error >"$LOG_DIR/npm.out" 2>&1); then
  tail -n 20 "$LOG_DIR/npm.out" | sed 's/^/    /'
  fail ui "npm ci in tools/ui-preview failed (needs the npm registry)"
elif (cd tools/ui-preview && npm run --silent shoot >"$LOG_DIR/ui.out" 2>&1); then
  shots=$(find tools/ui-preview/out -maxdepth 1 -name '*@*.png' ! -name '*-short.png' | wc -l)
  grep -E '^note:' "$LOG_DIR/ui.out" | sed 's/^/    /'
  pass ui "UI harness rendered $shots screenshots (every fixture at both widths) in tools/ui-preview/out"
else
  tail -n 40 "$LOG_DIR/ui.out" | sed 's/^/    /'
  fail ui "UI harness reported problems (see above)"
fi

# summary --------------------------------------------------------------------
echo
echo "== summary"
printf '  %s\n' "${RESULTS[@]}"
if (( FAILED )); then
  echo "Release check FAILED."
  exit 1
fi
echo "Release check passed. Live behaviour still needs docs/qa-checklist.md in Foundry."
