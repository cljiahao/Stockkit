# .husky/lib

## Purpose

Script bodies `.husky/pre-commit` and `.husky/commit-msg` delegate to.

## Contents

- `pre-commit.sh` — format/lint (`prettier`+`eslint --fix` on staged
  `.ts/.tsx/.js/.mjs/.cjs`, piped through `tr '\n' '\0' | xargs -0` so
  filenames with spaces/quotes are handled correctly — portable across GNU
  and BSD xargs, unlike `xargs -d '\n'`), `tsc --noEmit`, a frozen-lockfile
  install check when `package.json` is staged, a gitleaks secret-scan on
  staged files, then `readme-coupling.sh`.
- `readme-coupling.sh` — pre-commit nudge (non-blocking): warns to stderr
  when staged files touch a folder whose `README.md` wasn't also staged;
  the commit still proceeds.
- `commit-msg-check.sh` — Conventional Commits gate invoked by
  `.husky/commit-msg` with the message-file path as `$1`; non-zero exit
  rejects the commit.

## Parent

[.husky](../README.md)
