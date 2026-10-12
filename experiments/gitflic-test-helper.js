import { spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryDir = fileURLToPath(new URL("../", import.meta.url));
export const issueEraCommit = "a0d809747ca09bfed9a5dd0de1b919e25dad4b60";
export const issueRepository = {
  name: "deepcase.github.io",
  private: false,
  description: null,
  language: "TypeScript",
};

export const issueEraScript = () => execFileSync(
  "git", ["show", `${issueEraCommit}:js/push-repositories-to-gitflic.js`],
  { cwd: repositoryDir, encoding: "utf8" },
);

export function runGitFlicCLI({
  repos = [issueRepository],
  scenario = "missing",
  existingAlias = "deepcase-github-io",
  debug = false,
  scriptSource,
} = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gitflic-cli-test-"));
  try {
    const dataDir = path.join(directory, "data", "deep-foundation");
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(path.join(dataDir, "org.repos.json"), JSON.stringify(repos));
    const requestsFile = path.join(directory, "requests.json");
    fs.writeFileSync(requestsFile, "[]");

    let entrypoint = path.join(repositoryDir, "push-repositories-to-gitflic.js");
    if (scriptSource) {
      entrypoint = path.join(directory, "historical-script.mjs");
      fs.writeFileSync(entrypoint, scriptSource);
      fs.symlinkSync(path.join(repositoryDir, "node_modules"), path.join(directory, "node_modules"));
      // The historical script only uses readJSON and sleep, which are unchanged.
      fs.symlinkSync(path.join(repositoryDir, "lib.js"), path.join(directory, "lib.js"));
    }

    const result = spawnSync(process.execPath, [
      "--import", path.join(repositoryDir, "experiments", "gitflic-api-fixture.js"),
      entrypoint,
    ], {
      cwd: directory,
      encoding: "utf8",
      timeout: 10000,
      maxBuffer: 1024 * 1024,
      env: {
        ...process.env,
        GITFLIC_ACCESS_TOKEN: "fixture-access-token",
        SOURCE_ORGANIZATION: "deep-foundation",
        TARGET_ORGANIZATION: "link-foundation",
        GITFLIC_DEBUG: debug ? "1" : "0",
        GITFLIC_TEST_SCENARIO: scenario,
        GITFLIC_TEST_EXISTING_ALIAS: existingAlias,
        GITFLIC_TEST_REQUESTS: requestsFile,
      },
    });
    if (result.error) throw result.error;
    return { ...result, requests: JSON.parse(fs.readFileSync(requestsFile, "utf8")) };
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}
