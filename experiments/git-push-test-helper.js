import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryDir = fileURLToPath(new URL("../", import.meta.url));
// Last commit before the issue #1 fix: the empty repository push still aborts there.
export const preFixCommit = "3ada3b6167a048a5bba4312cc51eb5d337505503";

export const preFixScript = (script) => execFileSync(
  "git", ["show", `${preFixCommit}:${script}`],
  { cwd: repositoryDir, encoding: "utf8" },
);

// Runs a push-code-commits CLI with https://github.com/ and https://gitflic.ru/project/
// redirected to local bare repositories, so no network access is needed.
export function runPushCodeCLI({
  script = "push-code-commits.js",
  scriptSource,
  repositories = [{ name: "chatgpt-discord-bot" }],
  setup = () => {},
} = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "push-code-cli-test-"));
  try {
    const env = {
      ...process.env,
      GIT_CONFIG_GLOBAL: path.join(directory, "gitconfig"),
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_TERMINAL_PROMPT: "0",
      GITHUB_ACCESS_TOKEN: "fixture-access-token",
      SOURCE_ORGANIZATION: "deep-foundation",
      TARGET_ORGANIZATION: "link-foundation",
    };
    const git = (args, cwd = directory) =>
      execFileSync("git", args, { cwd, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    git(["config", "--global", "init.defaultBranch", "main"]);
    git(["config", "--global", "user.name", "Fixture"]);
    git(["config", "--global", "user.email", "fixture@example.com"]);
    git(["config", "--global", `url.file://${directory}/github/.insteadOf`, "https://github.com/"]);
    git(["config", "--global", "--add", `url.file://${directory}/gitflic/.insteadOf`, "https://gitflic.ru/project/"]);

    const dataDir = path.join(directory, "data", "deep-foundation");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "org.repos.json"), JSON.stringify(repositories));
    const source = (name) => path.join(directory, "github", "deep-foundation", `${name}.git`);
    const targets = {
      github: (name) => path.join(directory, "github", "link-foundation", `${name}.git`),
      gitflic: (name) => path.join(directory, "gitflic", "link-foundation", `${name}.git`),
    };
    for (const { name, alias = name } of repositories) {
      git(["init", "-q", "--bare", source(name)]);
      git(["init", "-q", "--bare", targets.github(name)]);
      git(["init", "-q", "--bare", targets.gitflic(alias)]);
      // pull.js clones every repository; an empty one leaves HEAD on an unborn branch.
      git(["clone", "-q", `https://github.com/deep-foundation/${name}.git`, path.join(dataDir, name)]);
    }
    setup({ directory, git, source, targets });

    let entrypoint = path.join(repositoryDir, script);
    if (scriptSource) {
      entrypoint = path.join(directory, "historical-script.mjs");
      fs.writeFileSync(entrypoint, scriptSource);
      fs.symlinkSync(path.join(repositoryDir, "node_modules"), path.join(directory, "node_modules"));
      fs.symlinkSync(path.join(repositoryDir, "lib.js"), path.join(directory, "lib.js"));
    }
    const result = spawnSync(process.execPath, [
      "--import", path.join(repositoryDir, "experiments", "fast-timers-fixture.js"),
      entrypoint,
    ], {
      cwd: directory,
      encoding: "utf8",
      input: "",
      timeout: 20000,
      maxBuffer: 1024 * 1024,
      env,
    });
    if (result.error) throw result.error;
    const refs = (repository) => !fs.existsSync(repository) ? [] :
      git(["for-each-ref", "--format=%(refname)", "refs/heads", "refs/tags"], repository)
        .split("\n").filter(Boolean).sort();
    const githubRefs = {};
    const gitflicRefs = {};
    for (const { name, alias = name } of repositories) {
      githubRefs[name] = refs(targets.github(name));
      gitflicRefs[alias] = refs(targets.gitflic(alias));
    }
    return { ...result, githubRefs, gitflicRefs };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
