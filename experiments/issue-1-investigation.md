# Issue #1 verification

The July 27, 2024 [issue](https://github.com/konard/gh-org-migrator/issues/1)
reports pushing `chatgpt-discord-bot` to `link-foundation` failing with
`There is no tracking information for the current branch.`

## Root cause

- The source repository is empty. `gh api repos/deep-foundation/chatgpt-discord-bot`
  reports `"size": 0` and `/branches` returns no branches (checked
  October 12, 2026). `pull.js` clones it, leaving `HEAD` on an unborn `main`.
- The logged `{ allLocalBranches: [] }` and `{ allBranches: [] }` lines exist
  only in issue-era commit [`f86dec1`](https://github.com/konard/gh-org-migrator/commit/f86dec19f99580373028be7245e1fed65da624ca)
  (`js/upload.js`). There `branchLocal().current` is `''` for an unborn
  branch, so `git.pull('origin', '')` runs without a branch. Re-adding
  `origin` also removed the upstream configuration, so git reports the missing
  tracking information. `node experiments/issue-1-historical-pull.js` replays
  those calls and prints the exact error from the issue.
- The current scripts still abort on the same repository, at a later step:
  with no refs at all, `git push origin --tags` fails with
  `No refs in common and none specified; doing nothing.` and
  `process.exit(1)` stops the whole migration. In
  `push-code-commits-to-gitflic.js` the error handler also referenced
  `updatedRepositoryName` outside its `try` block, so the error became
  `updatedRepositoryName is not defined`.
- The earlier change in this PR (`git.branchLocal()` →
  `git.cwd(repoDir).branchLocal()`) does not change behavior: `cwd()` on the
  root simple-git instance applies to every later command
  (`node experiments/simple-git-cwd-scope.js`). It is kept only to make the
  directory explicit.

## Fix

After fetching the source, both push scripts check whether the clone has
neither local nor remote branches. Such repositories are reported as
`Repository <name> is empty, nothing to push.` and skipped, so the migration
continues with the next repository. A repository cloned while empty but
populated later is still pushed, because fetching creates its remote branches.

## Reproduction and regression coverage

```bash
npm ci
npm test
experiments/issue-1-empty-repository.sh
experiments/issue-1-empty-repository.sh <(git show 3ada3b6:push-code-commits.js)
```

`experiments/test-push-code-commits.js` runs the real push CLIs with
`https://github.com/` and `https://gitflic.ru/project/` redirected to local
bare repositories through `url.<base>.insteadOf`, so no credentials or network
access are needed. It checks that the pre-fix scripts abort, that empty
repositories are skipped, and that branches and tags are still pushed for
populated repositories.
