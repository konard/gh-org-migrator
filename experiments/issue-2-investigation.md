# Issue #2: rejected pushes behind the target branch

The issue shows branch `#16` rejected with `(non-fast-forward)` while migrating
to `link-foundation/boilerplate`. Its only comment suggests deleting and
re-uploading the repository as a workaround. The original branch contents are
not recorded, so the tests construct both behind and divergent branch histories.

## Why the previous PR draft did not fix the failure

- `pushCodeChangesForRepository()` pulls from the source and then removes and
  recreates `origin` to point at the target. Removing the remote also removes
  branch upstream configuration.
- On a rejected push, the draft called `git.pull()` without a remote or branch.
  The real CLI reproduction fails with `There is no tracking information for
  the current branch`, even when a fast-forward would otherwise be possible.
- Supplying the missing remote alone is insufficient: the draft also passed
  `--ff-only`. Divergent source and target histories fail with `Not possible
  to fast-forward, aborting.` A second historical test demonstrates this.
- The draft pulled after every push error, including hook/permission failures,
  and offered another unchanged push after a failed pull.
- Its old `test-push-fix.js` initialized a repository but never called the push
  function, asserted results, or created a remote. It could not verify recovery.
- The issue's `Error pulling ...` label precedes an actual push rejection. The
  corrected diagnostic identifies pushing as the failed operation.

## Behavior now covered

For the actual Git porcelain rejection reasons `non-fast-forward` and
`fetch first`, accepting the default-no retry prompt runs:

```bash
git pull --no-rebase --ff --no-edit origin '#16'
git push origin '#16'
```

Naming the branch avoids missing or mismatched upstream configuration. `--ff`
allows both fast-forwards and merges even with `pull.ff=only`; `--no-rebase`
keeps both histories even with `pull.rebase=true`; `--no-edit` avoids opening an
editor. Recovery uses neither force pushes nor a conflict strategy that discards
either side. Other push errors retain the ordinary confirmed retry behavior.

A conflicting recovery aborts its own merge and propagates the real error
instead of retrying an unchanged push. Unrelated histories also stop. Dirty
working trees and pre-existing merges are left untouched.

Merging target work locally introduces a necessary follow-up case: on the next
migration, new source commits can diverge from that local merge. A reproducing
test initially showed that the existing fast-forward-only source pull logged an
error but returned success without uploading the new source tip. The source
pull now explicitly disables rebase and, on a fast-forward failure, uses the
same preserving merge. A failed source merge stops the migration as well.

## Reproduction and validation

```bash
npm ci
node --test experiments/test-push-fix.js
npm test
node experiments/verify-syntax.js
```

The previous draft is replayed from commit
`ebfbde87f78bdfc1690d41579c59dfd7e36aca0d`; full Git history is required. The
first two tests preserve its missing-upstream and fast-forward-only failures.
Before the production fix, five of the first six regression tests failed;
the new-source-after-target-merge test also failed before the source fallback.

The suite uses the existing real-CLI Git fixture from issue #1. GitHub URLs are
redirected to disposable local bare repositories. Only Inquirer confirmations
and rate-limit timers are replaced; fetching, merging, pushing, hooks, branch
enumeration, and tag operations run through real Git/simple-git. There are no
requests to GitHub or changes to live migration repositories.

Assertions cover behind and divergent branches, both exact rejection reasons,
source and target commit ancestry, retained file contents, inherited pull/editor
configuration, branch/tag pushes, repeated migrations, declined retries,
conflicts, unrelated history, uncommitted work, pre-existing merges, and a
transient hook rejection. The tests are part of `npm test` and the existing
Node.js 22/24 PR workflow. No release workflow exists, so no release version
change is required.

For further Git tracing, use the existing opt-in debug channels documented in
the README. The regression validates synchronization offline; the original
repository's historical branch state cannot be reconstructed from its issue
log alone. Conflicting and unrelated histories require manual reconciliation
and deliberately produce a failing exit status rather than losing commits.
