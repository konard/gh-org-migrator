#!/usr/bin/env node
// Replays the git calls of issue-era commit f86dec1 (js/upload.js, pushRepository)
// against a clone of an empty repository, which is what pull.js leaves for
// deep-foundation/chatgpt-discord-bot (size 0, no branches on GitHub).
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import simpleGit from "simple-git";

const directory = fs.mkdtempSync(path.join(os.tmpdir(), "issue-1-historical-"));
try {
  const source = path.join(directory, "chatgpt-discord-bot.git");
  const repoDir = path.join(directory, "chatgpt-discord-bot");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", source]);
  execFileSync("git", ["clone", "-q", source, repoDir], { stdio: "ignore" });

  const git = simpleGit();
  const branchSummary = await git.cwd(repoDir).branchLocal();
  const branchName = branchSummary.current;
  console.log({ allLocalBranches: branchSummary.all });
  const branches = await git.cwd(repoDir).branch();
  console.log({ allBranches: branches.all });
  await git.cwd(repoDir).removeRemote("origin");
  await git.cwd(repoDir).addRemote("origin", source);
  await git.cwd(repoDir).fetch("origin");
  try {
    await git.cwd(repoDir).pull("origin", branchName);
  } catch (error) {
    console.log({ branchName, error: error.message });
  }
} finally {
  fs.rmSync(directory, { recursive: true, force: true });
}
