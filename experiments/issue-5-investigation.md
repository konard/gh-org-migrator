# Issue #5 verification

The September 9, 2024 [issue](https://github.com/konard/gh-org-migrator/issues/5)
reports creation of `deepcase.github.io` failing with HTTP 422. The original
server response body and request payload were not included.

## Historical evidence

- At issue-era commit [`a0d8097`](https://github.com/konard/gh-org-migrator/commit/a0d809747ca09bfed9a5dd0de1b919e25dad4b60)
  (September 8, 2024), `js/push-repositories-to-gitflic.js` sends the raw
  repository name as both `title` and `alias`.
- [GitFlic's project creation documentation](https://docs.gitflic.ru/latest/en/project/project_create/)
  lists letters, digits, hyphens, and underscores as accepted name/alias
  characters. A dotted name does not satisfy that documented character set.
- Main-branch commit [`f7d6ac5`](https://github.com/konard/gh-org-migrator/commit/f7d6ac500d9496d06cca4ba42e8ff5e5c2ba4fc7)
  (September 11, 2024) replaces unsupported characters in the creation payload.
  [`7f9dcbf`](https://github.com/konard/gh-org-migrator/commit/7f9dcbfd47c69a0b5b2830d9a3f9198dc3cd9cd3)
  then shares the transformation with existence checks and code pushes.

This evidence supports an invalid dotted title/alias as the historical cause.
The original response body is unavailable, so other server-side validation
failures cannot be ruled out. The September 2025 PR's numeric-character fix
does not change `deepcase.github.io`: main already produced
`deepcase-github-io`. Its earlier claim that missing digits caused this exact
failure was unsupported.

## Reproduction and regression coverage

```bash
npm ci
npm test
node experiments/verify-issue-5.js
```

The comparison loads the actual historical CLI through `git show` and runs it
and today's CLI against the same offline Axios adapter. The adapter rejects
title/alias characters outside the documented set with a synthetic 422.
Production sleep intervals are skipped only in the test preload. The metadata
is fixture data, not a recovered copy of the 2024 request.

| CLI | Lookup alias | Creation title/alias | Fixture result |
| --- | --- | --- | --- |
| September 8, 2024 | `deepcase.github.io` | `deepcase.github.io` | 422, exit 1 |
| Current | `deepcase-github-io` | `deepcase-github-io` | 200, exit 0 |

The 15 name cases and 10 CLI tests also cover numeric names, existing repository
skips, 404 responses without Axios's status shortcut, preserved metadata,
permission and network failures, response diagnostics, and opt-in payload logs.

The previous PR introduced a separate reproducible regression: collapsing or
trimming valid hyphens mapped `test---repo` to `test-repo` and `-repo-` to `repo`.
With both source names present, the CLI created only one destination for each
pair and silently skipped the other. The CLI regression failed before the fix
and now verifies that all four distinct aliases are created. Existing hyphens
are preserved, while digits remain supported.

## Validation limits

The fixtures exercise the real CLI and serialized requests but do not reproduce
every GitFlic server rule. No GitFlic access token is available in this
environment; an unauthenticated project GET returned 403. Authenticated live
creation in `link-foundation` was not performed. Successful fixture tests
therefore establish the documented naming contract and request flow, not a
confirmed live-server reproduction or repair of the original response.

Future API failures retain the actual response status/body. `GITFLIC_DEBUG=1`
additionally logs the exact creation payload, without authentication headers,
to identify which fields a live server rejected.
