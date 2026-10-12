import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { preFixScript, runPushCodeCLI } from "./git-push-test-helper.js";

// deep-foundation/chatgpt-discord-bot from issue #1 has no commits and no branches.
const emptyRepository = { name: "chatgpt-discord-bot" };

const addCommits = ({ git, source, directory }, name, { tag } = {}) => {
  const workDir = `${directory}/work-${name}`;
  git(["clone", "-q", source(name), workDir]);
  git(["commit", "-q", "--allow-empty", "-m", "Initial commit"], workDir);
  git(["branch", "feature"], workDir);
  if (tag) git(["tag", tag], workDir);
  git(["push", "-q", "--all", "origin"], workDir);
  git(["push", "-q", "--tags", "origin"], workDir);
};

test("pre-fix GitHub CLI aborts the migration on an empty repository", { timeout: 30000 }, () => {
  const result = runPushCodeCLI({ scriptSource: preFixScript("push-code-commits.js") });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error pushing repository chatgpt-discord-bot:/);
  assert.doesNotMatch(result.stdout, /Data uploading completed/);
});

test("GitHub CLI skips empty repositories and continues the migration", { timeout: 30000 }, () => {
  const repositories = [emptyRepository, { name: "another-empty-repository" }];
  const result = runPushCodeCLI({ repositories });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.match(result.stdout, /Repository chatgpt-discord-bot is empty, nothing to push\./);
  assert.match(result.stdout, /Repository another-empty-repository is empty, nothing to push\./);
  assert.match(result.stdout, /Data uploading completed/);
  assert.deepEqual(result.githubRefs[emptyRepository.name], []);
});

test("GitHub CLI pushes commits added to the source after an empty clone", { timeout: 30000 }, () => {
  const result = runPushCodeCLI({
    setup: (context) => addCommits(context, emptyRepository.name, { tag: "v1.0.0" }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Repository chatgpt-discord-bot pushed successfully\./);
  assert.deepEqual(result.githubRefs[emptyRepository.name], [
    "refs/heads/feature",
    "refs/heads/main",
    "refs/tags/v1.0.0",
  ]);
});

test("GitHub CLI pushes repositories without tags", { timeout: 30000 }, () => {
  const result = runPushCodeCLI({
    setup: (context) => addCommits(context, emptyRepository.name),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.githubRefs[emptyRepository.name], ["refs/heads/feature", "refs/heads/main"]);
});

test("pre-fix GitFlic CLI aborts with an undefined variable on an empty repository", { timeout: 30000 }, () => {
  const result = runPushCodeCLI({ scriptSource: preFixScript("push-code-commits-to-gitflic.js") });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /updatedRepositoryName is not defined/);
});

test("GitFlic CLI skips empty repositories and continues the migration", { timeout: 30000 }, () => {
  const repositories = [{ name: "chatgpt.discord.bot", alias: "chatgpt-discord-bot" }];
  const result = runPushCodeCLI({ script: "push-code-commits-to-gitflic.js", repositories });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Repository chatgpt-discord-bot is empty, nothing to push\./);
  assert.match(result.stdout, /Data uploading completed/);
});

test("GitFlic CLI pushes branches and tags under the normalized name", { timeout: 30000 }, () => {
  const repositories = [{ name: "chatgpt.discord.bot", alias: "chatgpt-discord-bot" }];
  const result = runPushCodeCLI({
    script: "push-code-commits-to-gitflic.js",
    repositories,
    setup: (context) => addCommits(context, "chatgpt.discord.bot", { tag: "v1.0.0" }),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.gitflicRefs["chatgpt-discord-bot"], [
    "refs/heads/feature",
    "refs/heads/main",
    "refs/tags/v1.0.0",
  ]);
});

test("push failures report the GitFlic repository name instead of a ReferenceError", { timeout: 30000 }, () => {
  const repositories = [{ name: "chatgpt.discord.bot", alias: "chatgpt-discord-bot" }];
  const result = runPushCodeCLI({
    script: "push-code-commits-to-gitflic.js",
    repositories,
    setup: (context) => {
      addCommits(context, "chatgpt.discord.bot");
      // A missing target makes pushing fail after the remote switch.
      fs.rmSync(context.targets.gitflic("chatgpt-discord-bot"), { recursive: true });
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /chatgpt-discord-bot/);
  assert.doesNotMatch(result.stderr, /is not defined/);
});
