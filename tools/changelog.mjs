// Build CHANGELOG.md from git: one section per v* tag, newest first, listing
// the PRs merged between that tag and the previous one.
// Usage: node tools/changelog.mjs            print to stdout
//        node tools/changelog.mjs --write    write CHANGELOG.md at the repo root
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

function git(args) {
  return execFileSync("git", ["-C", ROOT, ...args], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
}

/** Tags v<semver> sorted oldest first. */
export function listVersionTags() {
  return git(["tag", "--list", "v*", "--sort=v:refname"])
    .split("\n")
    .map((tag) => tag.trim())
    .filter((tag) => /^v\d+\.\d+\.\d+$/.test(tag));
}

/**
 * Parse one merge commit. Merge subjects read "Merge pull request #N from
 * owner/branch"; the PR title is the first non-empty body line.
 */
export function parseMerge(subject, body, fallbackTitle = "") {
  const number = /#(\d+)/.exec(subject)?.[1];
  const title = body.split("\n").map((line) => line.trim()).find(Boolean) ?? fallbackTitle;
  return { subject, number: number ? Number(number) : null, title: title || subject };
}

/**
 * Branch-style merges ("Merge branch ..." or "Merge <name>" with no PR number)
 * are noise in a changelog. They are kept only when they are all a tag has.
 */
export function isBranchMerge(merge) {
  return /^Merge branch /.test(merge.subject) || (merge.number === null && /^Merge /.test(merge.subject));
}

/** Entries for one tag: PR-style merges, or the branch-style ones when there are no others. */
export function entriesForTag(merges) {
  const kept = merges.filter((merge) => !isBranchMerge(merge));
  return kept.length ? kept : merges;
}

/** Merge commits reachable from `to` but not from `from` (exclusive), newest first. */
export function mergesBetween(from, to) {
  const range = from ? `${from}..${to}` : to;
  const out = git(["log", "--merges", "--format=%H%x1f%s%x1f%b%x1e", range]);
  return out
    .split("\x1e")
    .map((record) => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [, subject = "", body = ""] = record.split("\x1f");
      return parseMerge(subject, body);
    });
}

/** Markdown for all tags, newest first. */
export function buildChangelog(tags = listVersionTags()) {
  const sections = ["# Changelog", "", "Generated from merged pull requests by `tools/changelog.mjs`.", ""];
  for (let i = tags.length - 1; i >= 0; i--) {
    const tag = tags[i];
    const previous = i > 0 ? tags[i - 1] : null;
    const date = git(["log", "-1", "--format=%cs", tag]).trim();
    sections.push(`## ${tag} (${date})`, "");
    const merges = entriesForTag(mergesBetween(previous, tag));
    if (merges.length === 0) sections.push("- No merged pull requests recorded.");
    for (const merge of merges) {
      sections.push(merge.number ? `- ${merge.title} (#${merge.number})` : `- ${merge.title}`);
    }
    sections.push("");
  }
  return sections.join("\n");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const text = buildChangelog();
  if (process.argv.includes("--write")) {
    writeFileSync(join(ROOT, "CHANGELOG.md"), text, "utf8");
    console.log(`wrote ${join(ROOT, "CHANGELOG.md")}`);
  } else {
    process.stdout.write(text);
  }
}
