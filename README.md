# gh-org-migrator (GitHub Organization Migrator)
A tool to migrate organization

# JavaScript version (the only one recommended at the moment)

0. Install dependencies

```bash
yarn
```

1. Create .env file:

```bash
touch .env
nano .env
```

```env
GITHUB_ACCESS_TOKEN=
GITFLIC_ACCESS_TOKEN=
SOURCE_ORGANIZATION=deep-foundation
TARGET_ORGANIZATION=link-foundation
```

2. Download data from source organization

```bash
node pull.js
```

3. Upload data to target organization

```bash
node push.js
```

## Push repositories

```bash
node push-repositories.js 2>&1 | tee push-repositories.log.txt
```

```bash
node push-repositories.js > >(tee -a push-repositories.stdout.log.txt) 2> >(tee -a push-repositories.stderr.log.txt >&2)
```

## Push repositories to GitFlic

```bash
node push-repositories-to-gitflic.js 2>&1 | tee push-repositories-to-gitflic.log.txt
```

```bash
node push-repositories-to-gitflic.js > >(tee -a push-repositories-to-gitflic.stdout.log.txt) 2> >(tee -a push-repositories-to-gitflic.stderr.log.txt >&2)
```

GitFlic names replace unsupported characters, including dots, with hyphens.
For example, `deepcase.github.io` becomes `deepcase-github-io`. Digits,
underscores, existing hyphens, and letter case are preserved. Creation and code
pushes use the same name transformation.

API failures report the response status and body. To also log creation payloads
without authentication headers, enable verbose diagnostics:

```bash
GITFLIC_DEBUG=1 node push-repositories-to-gitflic.js
```

Verbose payload logging is disabled by default.

## Tests

```bash
npm ci
npm test
node experiments/verify-issue-5.js
```

The tests run the real GitFlic creation CLI against an offline Axios fixture;
they use no real credentials and make no remote changes. Full Git history is
needed to replay the issue-era CLI. The comparison reproduces its dotted-name
422 and checks the current CLI's normalized request. See the
[issue #5 investigation](experiments/issue-5-investigation.md) for evidence and
the limits of this validation.

The code push tests run the real push CLIs against local bare repositories that
stand in for GitHub and GitFlic. See the
[issue #1 investigation](experiments/issue-1-investigation.md).
The issue #2 tests also reproduce rejected pushes and verify branch history
preservation, conflict handling, and subsequent migrations. Run them separately
with `node --test experiments/test-push-fix.js`; see the
[issue #2 investigation](experiments/issue-2-investigation.md).

## Push issues

```bash
node push-issues.js 2>&1 | tee push-issues.log.txt
```

```bash
node push-issues.js > >(tee -a push-issues.stdout.log.txt) 2> >(tee -a push-issues.stderr.log.txt >&2)
```

## Push code commits

```bash
node push-code-commits.js 2>&1 | tee push-code-commits.log.txt
```

```bash
node push-code-commits.js > >(tee -a push-code-commits.stdout.log.txt) 2> >(tee -a push-code-commits.stderr.log.txt >&2)
```

Empty source repositories have no commits to push, so they are reported as
empty and skipped.

When Git rejects a branch push with `non-fast-forward` or `fetch first`, the
retry prompt offers to pull and merge that same branch from the target `origin`.
Accepting fast-forwards a behind branch or merges divergent histories while
preserving source and target commits. Later migrations also merge new source
commits into the local branch when it contains previously migrated target work.
Merge conflicts and unrelated histories stop the migration; an attempted
conflicting merge is aborted, and the error must be resolved before rerunning.

To trace Git commands and output, enable simple-git's existing diagnostics
(disabled by default):

```bash
DEBUG=simple-git:task:*,simple-git:output:* node push-code-commits.js
```

## Push code commits to GitFlic

```bash
node push-code-commits-to-gitflic.js 2>&1 | tee push-code-commits-to-gitflic.log.txt
```

```bash
node push-code-commits-to-gitflic.js > >(tee -a push-code-commits-to-gitflic.stdout.log.txt) 2> >(tee -a push-code-commits-to-gitflic.stderr.log.txt >&2)
```

