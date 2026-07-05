# /metaswarm-setup

This project is already configured for Metaswarm. The full interactive setup wizard is intentionally not vendored here because it is large and drifts from the installed plugin.

## Current Project Profile

Read `.metaswarm/project-profile.json` for detected stack, commands, external-tool settings, and project paths.

## Re-run Setup

If setup genuinely needs to be re-run, invoke the installed plugin command:

```text
/metaswarm:setup
```

Before changing project files, compare the generated result against:

- `docs/context-router.md`
- `docs/agent-harness.md`
- `.metaswarm/project-profile.json`
- `.metaswarm/external-tools.yaml`

Do not reintroduce full-document startup lists, Claude-invoked reviewer CLIs, or inline review packets.
