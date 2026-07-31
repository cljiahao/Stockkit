# .husky/lib

## Purpose

Script bodies `.husky/pre-commit` and `.husky/commit-msg` delegate to.

## Contents

- `readme-coupling.sh` — pre-commit nudge (non-blocking): warns to stderr
  when staged files touch a folder whose `README.md` wasn't also staged;
  the commit still proceeds.
- `commit-msg-check.sh` — Conventional Commits gate invoked by
  `.husky/commit-msg` with the message-file path as `$1`; non-zero exit
  rejects the commit.

## Parent

[.husky](../README.md)
