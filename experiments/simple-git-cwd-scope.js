#!/usr/bin/env node
// Checks whether `git.cwd(dir)` on the root simple-git instance changes the
// directory of later commands. If it does, `git.branchLocal()` already ran in
// the repository directory and adding `.cwd(repoDir)` alone cannot fix issue #1.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "simple-git-cwd-"));
try {
  execFileSync("git", ["init", "-q", "-b", "probe-branch", directory]);
  execFileSync("git", ["-C", directory, "-c", "user.name=t", "-c", "user.email=t@e", "commit", "-q", "--allow-empty", "-m", "probe"]);
  const git = simpleGit();
  await git.cwd(directory).fetch(["--all"]);
  const branches = await git.branchLocal();
  console.log({ branchesWithoutExplicitCwd: branches.all });
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
