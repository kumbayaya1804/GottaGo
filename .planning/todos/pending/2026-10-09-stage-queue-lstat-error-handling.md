# stage-queue: fail loudly on lstat errors other than absence

Created: 2026-10-09 from a Codex follow-up note on the skills-restructure review (scope `sha256:44b56b5d…`).

`isStagedDeletion()` in `.claude/hooks/harness-hooks.js` (after the `lstat` change on `chore/skills-restructure`)
treats every `lstat` error as "absent". Codex reproduced an EACCES case: a replacement file behind an
inaccessible directory was classified as a staged deletion, `stage-queue` exited 0, and the replacement was
left out of the staged scope. The same behavior existed with `fs.existsSync`, so it is inherited, not new.

Fix (TDD, hooks batch, full tier): treat only `ENOENT` and `ENOTDIR` as absence; rethrow anything else so
`stage-queue` fails non-zero. Add a test that creates the unreadable-directory case (skip on Windows).
