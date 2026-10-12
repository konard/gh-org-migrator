import assert from "node:assert/strict";
import { issueEraCommit, issueEraScript, runGitFlicCLI } from "./gitflic-test-helper.js";

// Compare real CLI requests against the same offline name-validation fixture.
// No GitFlic credentials are used and no repositories are created remotely.
const before = runGitFlicCLI({ scriptSource: issueEraScript() });
const after = runGitFlicCLI();

assert.equal(before.status, 1);
assert.match(before.stderr, /422/);
assert.equal(after.status, 0, after.stderr);

console.log(JSON.stringify({
  validation: "Offline fixture using GitFlic's documented name character set; not a live API check",
  before: { commit: issueEraCommit, exitCode: before.status, requests: before.requests, error: before.stderr.trim() },
  after: { exitCode: after.status, requests: after.requests },
}, null, 2));
