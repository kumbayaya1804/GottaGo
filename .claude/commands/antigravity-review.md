# /antigravity-review

Invoke the Antigravity CLI on all files currently queued in `.claude/review-queue.txt`.

## Steps

1. Read `.claude/review-queue.txt`. If it is empty or missing, tell the user there is nothing to review and stop.

2. Read the following context files. Include only the sections needed for the current review packet unless the whole file is directly relevant:
   - `ANTIGRAVITY.md`
   - `AGENTS_ROSTER.md`
   - `AGENTS.md`
   - `docs/agent-harness.md`
   - `SPEC.md`
   - `docs/schema-contract.md`
   - `docs/review-severity.md`
   - `docs/verification.md`
   - `docs/stale-info-scan.md`
   - `.planning/stale-info-scan-latest.md` if present

3. Read each file listed in the review queue.

4. Run the Antigravity CLI with the combined prompt. Include `docs/agent-harness.md`, `docs/stale-info-scan.md`, the latest stale-information scan if present, verification evidence, every file listed in `.claude/review-queue.txt`, and the nearest runtime-boundary files that can affect the changed behavior. Use the following PowerShell command pattern on Windows, adjusting the file list from the queue:

```powershell
$files = Get-Content .claude\review-queue.txt | Where-Object { $_.Trim() }
$gitStatus = git status --short
$gitDiff = git diff HEAD -- $files

# Find calling/dependent files (excluding files already queued)
$dependencies = @()
$files | ForEach-Object {
  $name = [System.IO.Path]::GetFileNameWithoutExtension($_)
  if ($name -and $_ -match '\.tsx?$') {
    $escapedName = [regex]::Escape($name)
    $pattern = 'from [''"].*' + $escapedName + '[''"]|' + $escapedName + '|useSession|useSegments|router\.|rpc\(|onAuthStateChange'
    $refs = Get-ChildItem -Path app\src -Recurse -File -ErrorAction SilentlyContinue |
      Select-String -Pattern $pattern -ErrorAction SilentlyContinue |
      Select-Object -ExpandProperty Path -Unique
    $dependencies += $refs
  }
}
$dependencies = $dependencies | Where-Object { $files -notcontains $_ }

$prompt = @(
  Get-Content ANTIGRAVITY.md -Raw
  Get-Content AGENTS_ROSTER.md -Raw
  Get-Content AGENTS.md -Raw
  Get-Content docs\agent-harness.md -Raw
  Get-Content SPEC.md -Raw
  Get-Content docs\schema-contract.md -Raw
  Get-Content docs\review-severity.md -Raw
  Get-Content docs\verification.md -Raw
  Get-Content docs\stale-info-scan.md -Raw
  if (Test-Path .planning\stale-info-scan-latest.md) { Get-Content .planning\stale-info-scan-latest.md -Raw }
  '---'
  '## Verification Context'
  '=== Git Status ==='
  $gitStatus
  '=== Git Diffs ==='
  $gitDiff
  '---'
  '## Dependency Call Chains And Runtime Boundaries'
  if ($dependencies) {
    $dependencies | ForEach-Object { "=== DEPENDENCY FILE: $_ ===`n$(Get-Content $_ -Raw)" }
  } else {
    'No external dependency files detected in app/src.'
  }
  '---'
  '## Runtime Boundary And Mock Audit'
  'Audit nearest callers/callees, providers, route guards, hooks, RPCs, migrations, policies, scheduled jobs, and external callbacks that can affect this change.'
  'Check whether tests mock those boundaries and whether the mocks hide production behavior.'
  'For PostGIS, RLS, trust/shadowban, auth, GPS, Supabase writes, and async UI flows, verify event ordering and failure paths.'
  '---'
  'Review the following changed files. Return your verdict in the Antigravity review format defined in ANTIGRAVITY.md.'
  ($files | ForEach-Object { "=== FILE: $_ ===`n$(Get-Content $_ -Raw)" })
) -join "`n"

$prompt | Set-Content -Path .claude\antigravity-prompt-latest.md
$response = antigravity -p $prompt
$response | Set-Content -Path .claude\antigravity-review-latest.md
$response
```

5. Save the full Antigravity response to `.claude/antigravity-review-latest.md` and display it to the user.

6. Based on Antigravity's verdict:
   - **APPROVE**: Inform the user Antigravity has approved. Do not clear the queue yet — wait for Codex via `/codex-prompt`.
   - **REQUEST CHANGES**: List all findings by severity. Do not commit. Claude must fix all REQUEST CHANGES items before re-running.
   - **BLOCK**: Stop everything. List BLOCK findings clearly. No commit until all BLOCK items are resolved and Antigravity re-reviews.

7. If the verdict contains both BLOCK/REQUEST CHANGES findings and APPROVE items, treat the overall verdict as the strictest level present.

## Notes

- Run this command after every non-trivial implementation task, before generating the Codex prompt.
- If Antigravity CLI is not available (command not found), tell the user to install it and provide the manual prompt they can run themselves.
- Never skip this step to move faster. The review gate exists because PostGIS, RLS, and trust-engine correctness cannot be safely self-reviewed.
- Antigravity review is independent. Do not ask Antigravity to approve based on Claude's summary; include actual files, verification evidence, dependency boundaries, and mock-boundary context.
