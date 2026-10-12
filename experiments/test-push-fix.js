#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { runPushCodeCLI } from "./git-push-test-helper.js";

const name = "boilerplate";
const branch = "#16";
const moduleURL = new URL("../push-code-commits.js", import.meta.url).href;
const previousDraft = execFileSync("git", ["show", "ebfbde87f78bdfc1690d41579c59dfd7e36aca0d:push-code-commits.js"], { encoding: "utf8" });

// Model a migrated repository with a shared base and newer destination commits.
function setupRepository(context, { divergent = false, conflict = false, unrelated = false } = {}) {
  const { directory, git, source, targets } = context;
  const work = path.join(directory, "source-work");
  git(["clone", "-q", source(name), work]);
  fs.writeFileSync(path.join(work, "shared.txt"), "base\n");
  git(["add", "."], work);
  git(["commit", "-qm", "Shared base"], work);
  git(["branch", branch], work);
  git(["push", "-q", "--all", "origin"], work);
  git(["push", "-q", "--all", targets.github(name)], work);
  git(["checkout", "-q", branch], work);

  const targetWork = path.join(directory, "target-work");
  git(["clone", "-q", targets.github(name), targetWork]);
  git(["checkout", "-q", branch], targetWork);
  if (unrelated) git(["checkout", "-q", "--orphan", "unrelated"], targetWork);
  fs.writeFileSync(path.join(targetWork, conflict ? "shared.txt" : "target.txt"), "target changes\n");
  git(["add", "."], targetWork);
  git(["commit", "-qm", "Target changes"], targetWork);
  // Only fixture setup uses force to construct an unrelated target history.
  git(["push", "-q", ...(unrelated ? ["--force"] : []), "origin", `HEAD:refs/heads/${branch}`], targetWork);
  context.targetBefore = git(["rev-parse", branch], targets.github(name)).trim();

  if (divergent || conflict) {
    fs.writeFileSync(path.join(work, conflict ? "shared.txt" : "source.txt"), "source changes\n");
    git(["add", "."], work);
    git(["commit", "-qm", "Source changes"], work);
    git(["push", "-q", "origin", branch], work);
  }
  git(["tag", "v1.0.0"], work);
  git(["push", "-q", "origin", "--tags"], work);
  context.sourceBefore = git(["rev-parse", branch], source(name)).trim();
}

function inspectRepository(context) {
  const { directory, dataDir, git, source, targets, sourceBefore, targetBefore } = context;
  const local = path.join(dataDir, name);
  const targetAfter = git(["rev-parse", branch], targets.github(name)).trim();
  const promptFile = path.join(directory, "prompts.jsonl");
  const prompts = fs.existsSync(promptFile)
    ? fs.readFileSync(promptFile, "utf8").trim().split("\n").map((line) => JSON.parse(line)) : [];
  return {
    prompts, sourceBefore, targetBefore, targetAfter,
    sourceAfter: git(["rev-parse", branch], source(name)).trim(),
    localAfter: git(["rev-parse", branch], local).trim(),
    targetHistory: git(["rev-list", branch], targets.github(name)).trim().split("\n"),
    targetFiles: git(["ls-tree", "--name-only", branch], targets.github(name)).trim().split("\n"),
    localStatus: git(["status", "--porcelain"], local),
    mergeInProgress: fs.existsSync(path.join(local, ".git", "MERGE_HEAD")),
    hookCount: fs.existsSync(path.join(directory, "hook-count"))
      ? fs.readFileSync(path.join(directory, "hook-count"), "utf8").trim() : "",
  };
}

function runRecovery({ answers = [true], setup, scriptSource, ...options } = {}) {
  return runPushCodeCLI({
    scriptSource,
    repositories: [{ name }],
    imports: ["push-prompt-fixture.js"],
    setup: (context) => {
      context.env.PUSH_TEST_ANSWERS = JSON.stringify(answers);
      context.env.PUSH_TEST_PROMPTS = path.join(context.directory, "prompts.jsonl");
      setupRepository(context, options);
      setup?.(context);
    },
    inspect: inspectRepository,
  });
}

test("previous draft reproduces the missing-upstream failure instead of fixing the rejected push", { timeout: 30000 }, () => {
  const result = runRecovery({ scriptSource: previousDraft, answers: [true, false] });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /There is no tracking information/);
  assert.equal(result.targetAfter, result.targetBefore);
  assert.equal(result.localAfter, result.sourceBefore);
});

test("adding an explicit remote to the previous draft still fails on divergent histories with ff-only", { timeout: 30000 }, () => {
  const scriptSource = previousDraft.replaceAll(
    '.pull({ "--ff-only": null, "--strategy-option": "theirs" })',
    '.pull("origin", (await git.branchLocal()).current, { "--ff-only": null, "--strategy-option": "theirs" })',
  );
  const result = runRecovery({ scriptSource, divergent: true, answers: [true, false] });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Not possible to fast-forward/);
  assert.equal(result.targetAfter, result.targetBefore);
  assert.equal(result.localAfter, result.sourceBefore);
});

test("retry fast-forwards the exact target branch after origin replacement removed upstream", { timeout: 30000 }, () => {
  const result = runRecovery();
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.localAfter, result.targetBefore);
  assert.equal(result.targetAfter, result.targetBefore);
  assert.equal(result.prompts.length, 1);
  assert.match(result.prompts[0].question.message, /#16/);
  assert.deepEqual(result.githubRefs[name], ["refs/heads/#16", "refs/heads/main", "refs/tags/v1.0.0"]);
});

test("retry merges divergent histories and preserves both tips despite pull.ff and pull.rebase defaults", { timeout: 30000 }, () => {
  const result = runRecovery({
    divergent: true,
    setup: ({ git, env }) => {
      git(["config", "--global", "pull.ff", "only"]);
      git(["config", "--global", "pull.rebase", "true"]);
      env.GIT_MERGE_AUTOEDIT = "yes";
      env.GIT_EDITOR = "false";
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.targetHistory.includes(result.sourceBefore), "source tip must remain an ancestor");
  assert.ok(result.targetHistory.includes(result.targetBefore), "target tip must remain an ancestor");
  assert.deepEqual(result.targetFiles, ["shared.txt", "source.txt", "target.txt"]);
  assert.equal(result.sourceAfter, result.sourceBefore, "source repository must not change");
  assert.equal(result.prompts.length, 1);
  assert.equal(result.localStatus, "");
  assert.equal(result.mergeInProgress, false);
});

test("the exact non-fast-forward rejection from issue #2 also triggers synchronization", { timeout: 30000 }, () => {
  const result = runRecovery({
    divergent: true,
    setup: ({ git, targets, dataDir }) => {
      // Knowing the remote tip changes Git's rejection reason from fetch-first to non-fast-forward.
      git(["fetch", targets.github(name), branch], path.join(dataDir, name));
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stderr, /\[rejected\] \(non-fast-forward\)/);
  assert.ok(result.targetHistory.includes(result.sourceBefore));
  assert.ok(result.targetHistory.includes(result.targetBefore));
});

const repeatedMigrationScript = (file = "late.txt") => `
  import fs from "node:fs";
  import { execFileSync } from "node:child_process";
  import { pushCodeChangesForRepository } from ${JSON.stringify(moduleURL)};
  await pushCodeChangesForRepository("boilerplate");
  fs.writeFileSync(${JSON.stringify(`source-work/${file}`)}, "later source change\\n");
  const git = (args) => execFileSync("git", args, { cwd: "source-work" });
  git(["add", "."]);
  git(["commit", "-qm", "Later source commit"]);
  git(["push", "-q", "origin", "#16"]);
  await pushCodeChangesForRepository("boilerplate");
`;

test("a later migration still imports new source commits after merging target history locally", { timeout: 30000 }, () => {
  const result = runRecovery({
    divergent: true,
    setup: ({ git }) => {
      git(["config", "--global", "pull.ff", "only"]);
      git(["config", "--global", "pull.rebase", "true"]);
    },
    scriptSource: repeatedMigrationScript(),
  });
  assert.equal(result.status, 0, result.stderr);
  assert.ok(result.targetHistory.includes(result.sourceAfter), "new source tip must reach the destination");
  assert.ok(result.targetHistory.includes(result.targetBefore), "previous target tip must still be preserved");
  assert.deepEqual(result.targetFiles, ["late.txt", "shared.txt", "source.txt", "target.txt"]);
  assert.equal(result.localStatus, "");
});

test("conflicting source changes on a later migration also stop safely", { timeout: 30000 }, () => {
  const result = runRecovery({ divergent: true, scriptSource: repeatedMigrationScript("target.txt") });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /conflict/i);
  assert.ok(result.targetHistory.includes(result.sourceBefore));
  assert.ok(result.targetHistory.includes(result.targetBefore));
  assert.ok(!result.targetHistory.includes(result.sourceAfter), "conflicting source work must not replace target work");
  assert.equal(result.localAfter, result.targetAfter);
  assert.equal(result.localStatus, "");
  assert.equal(result.mergeInProgress, false);
});

test("declining retry leaves both branch histories unchanged", { timeout: 30000 }, () => {
  const result = runRecovery({ divergent: true, answers: [false] });
  assert.equal(result.status, 1);
  assert.equal(result.targetAfter, result.targetBefore);
  assert.equal(result.localAfter, result.sourceBefore);
  assert.equal(result.prompts.length, 1);
  assert.equal(result.prompts[0].question.default, false);
  assert.doesNotMatch(result.stdout, /Pulling (?:and merging|latest changes)/);
});

test("conflicting histories stop safely and abort the attempted merge", { timeout: 30000 }, () => {
  const result = runRecovery({ conflict: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /conflict/i);
  assert.equal(result.prompts.length, 1, "a failed merge must not offer another unchanged push");
  assert.equal(result.targetAfter, result.targetBefore);
  assert.equal(result.localAfter, result.sourceBefore);
  assert.equal(result.localStatus, "");
  assert.equal(result.mergeInProgress, false);
});

test("unrelated target history fails without overwriting commits or retrying the unchanged push", { timeout: 30000 }, () => {
  const result = runRecovery({ unrelated: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unrelated histories/);
  assert.equal(result.prompts.length, 1);
  assert.equal(result.targetAfter, result.targetBefore);
  assert.equal(result.localAfter, result.sourceBefore);
  assert.equal(result.localStatus, "");
});

const pushOnlyScript = `
  import { pushAllLocalBranches } from ${JSON.stringify(moduleURL)};
  try {
    await pushAllLocalBranches(process.cwd() + "/data/deep-foundation/boilerplate");
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
`;

function prepareDirectPush({ git, dataDir, targets }) {
  const local = path.join(dataDir, name);
  git(["fetch", "origin"], local);
  git(["checkout", "-qb", branch, `origin/${branch}`], local);
  git(["remote", "set-url", "origin", targets.github(name)], local);
  return local;
}

test("recovery leaves uncommitted local changes untouched", { timeout: 30000 }, () => {
  const result = runRecovery({
    scriptSource: pushOnlyScript,
    setup: (context) => {
      const local = prepareDirectPush(context);
      fs.writeFileSync(path.join(local, "shared.txt"), "uncommitted local work\n");
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Commit or stash local changes/);
  assert.equal(result.targetAfter, result.targetBefore);
  assert.equal(result.localAfter, result.sourceBefore);
  assert.equal(result.localStatus, " M shared.txt\n");
  assert.equal(result.mergeInProgress, false);
});

test("recovery does not abort a merge that was already in progress", { timeout: 30000 }, () => {
  const result = runRecovery({
    conflict: true,
    scriptSource: pushOnlyScript,
    setup: (context) => {
      const local = prepareDirectPush(context);
      context.git(["fetch", "origin", branch], local);
      assert.throws(() => context.git(["merge", "--no-edit", "FETCH_HEAD"], local));
    },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Finish the existing merge|resolve your current index/);
  assert.equal(result.targetAfter, result.targetBefore);
  assert.equal(result.localAfter, result.sourceBefore);
  assert.equal(result.localStatus, "UU shared.txt\n");
  assert.equal(result.mergeInProgress, true);
});

test("other push errors retain retry behavior without pulling from the target", { timeout: 30000 }, () => {
  const result = runRecovery({
    setup: ({ directory, git, targets }) => {
      // Make the target equal to the source first, then reject one push with a hook.
      git(["update-ref", `refs/heads/${branch}`, "refs/heads/main"], targets.github(name));
      const hook = path.join(targets.github(name), "hooks", "pre-receive");
      fs.writeFileSync(hook, `#!/bin/sh\ncount_file='${directory}/hook-count'\nif [ ! -f "$count_file" ]; then\n  echo 1 > "$count_file"\n  echo 'Fixture transient rejection' >&2\n  exit 1\nfi\necho 2 > "$count_file"\n`);
      fs.chmodSync(hook, 0o755);
      // Need a source-only commit so a pre-receive hook actually runs.
      const work = path.join(directory, "source-work");
      git(["commit", "-q", "--allow-empty", "-m", "Source-only change"], work);
      git(["push", "-q", "origin", branch], work);
    },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.hookCount, "2");
  assert.equal(result.prompts.length, 1);
  assert.doesNotMatch(result.stdout, /Pulling (?:and merging|latest changes)/);
});
