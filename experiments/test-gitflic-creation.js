import assert from "node:assert/strict";
import test from "node:test";
import { issueEraScript, issueRepository, runGitFlicCLI } from "./gitflic-test-helper.js";

test("issue-era CLI reproduces the dotted-name HTTP 422", { timeout: 15000 }, () => {
  const result = runGitFlicCLI({ scriptSource: issueEraScript() });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Error creating repository deepcase\.github\.io:.*422/);
  assert.equal(result.requests[1].payload.title, "deepcase.github.io");
  assert.equal(result.requests[1].payload.alias, "deepcase.github.io");
});

test("current CLI creates the issue repository after a 404 using normalized title and alias", { timeout: 15000 }, () => {
  const result = runGitFlicCLI();
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.requests, [
    { method: "get", url: "https://api.gitflic.ru/project/link-foundation/deepcase-github-io" },
    {
      method: "post",
      url: "https://api.gitflic.ru/project",
      payload: {
        ownerAlias: "link-foundation",
        ownerAliasType: "COMPANY",
        title: "deepcase-github-io",
        alias: "deepcase-github-io",
        isPrivate: issueRepository.private,
        description: issueRepository.description,
        language: issueRepository.language,
      },
    },
  ]);
  assert.match(result.stdout, /Repositories creation completed/);
});

test("existing normalized repository is skipped without a creation request", { timeout: 15000 }, () => {
  const result = runGitFlicCLI({ scenario: "existing" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requests.length, 1);
  assert.match(result.stdout, /already exists on GitFlic/);
});

test("404 responses without the Axios status shortcut still allow creation", { timeout: 15000 }, () => {
  const result = runGitFlicCLI({ scenario: "response-only-404" });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.requests[1].method, "post");
});

test("distinct valid hyphenated names each get their own repository", { timeout: 15000 }, () => {
  const names = ["test---repo", "test-repo", "-repo-", "repo"];
  const result = runGitFlicCLI({ repos: names.map((name) => ({ ...issueRepository, name })) });
  assert.equal(result.status, 0, result.stderr);
  const creations = result.requests.filter((request) => request.method === "post");
  assert.deepEqual(creations.map(({ payload }) => payload.alias), names);
});

test("numeric aliases and repository metadata survive the creation request", { timeout: 15000 }, () => {
  const repo = { name: "release2.github.io", private: true, description: "Release 2", language: "JavaScript" };
  const result = runGitFlicCLI({ repos: [repo] });
  assert.equal(result.status, 0, result.stderr);
  const { payload } = result.requests[1];
  assert.equal(payload.alias, "release2-github-io");
  assert.equal(payload.title, payload.alias);
  assert.equal(payload.isPrivate, true);
  assert.equal(payload.description, repo.description);
  assert.equal(payload.language, repo.language);
});

test("forbidden lookup aborts without attempting to create a repository", { timeout: 15000 }, () => {
  const result = runGitFlicCLI({ scenario: "lookup-forbidden" });
  assert.equal(result.status, 1);
  assert.equal(result.requests.length, 1);
  assert.match(result.stderr, /403/);
  assert.match(result.stderr, /Fixture access denied/);
});

test("network errors are reported without requiring an HTTP response", { timeout: 15000 }, () => {
  const result = runGitFlicCLI({ scenario: "network-error" });
  assert.equal(result.status, 1);
  assert.equal(result.requests.length, 1);
  assert.match(result.stderr, /Fixture network failure/);
});

test("creation 422 reports server details with verbose payload logging disabled by default", { timeout: 15000 }, () => {
  const result = runGitFlicCLI({ scenario: "creation-validation" });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /422/);
  assert.match(result.stderr, /Fixture validation failure/);
  assert.doesNotMatch(result.stderr, /Request Payload|Possible causes/);
  assert.doesNotMatch(result.stderr, /fixture-access-token/);
  assert.doesNotMatch(result.stdout, /Repositories creation completed/);
});

test("debug mode logs the actual creation payload without the access token", { timeout: 15000 }, () => {
  const result = runGitFlicCLI({ scenario: "creation-validation", debug: true });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Request Payload:/);
  assert.match(result.stderr, /"alias": "deepcase-github-io"/);
  assert.doesNotMatch(result.stderr, /fixture-access-token/);
});
