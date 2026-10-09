---
name: user-advocacy-gate
description: Use when planning, implementing, or reviewing any Gotta Go change a user can feel, including screens, emergency mode, error, empty, offline, or denied-location states, and backend or RPC changes that alter what the map, list, or verify flow shows or how fast it responds.
---

# Skill: User Advocacy Gate

## Purpose

Apply the `AGENTS.md` gate, "Does this decision serve someone with 60 seconds before an emergency?", with the project's locked numbers and copy instead of general platform defaults.

## Sources

- `docs/design/design-system.md` section 15 (Error-State Copy Matrix, ERR-01 to ERR-11) and section 17 (Emergency-Use UX Rules).
- `docs/design/flows.md` Emergency Mode, Offline, No-Location, and No-Results flows.
- `SPEC.md` Core User Flows.

Read the relevant rows; do not paraphrase them from memory.

## Rules

- Project sizes override platform minimums, per control (section 17.1): FAB 64x64pt, bottom-right, 24pt plus safe area from the bottom; sheet "Navigate" CTA full-width, 56pt; "Dismiss" 44pt; header "Navigate" icon 44x44pt; mode chips 36pt. Emergency controls sit in the lower 60% of the screen. Judge each control against its own row: a 44pt FAB is a defect, a 44pt Dismiss is compliant.
- Emergency mode is reachable in at most 2 taps from any tab. Any confirmation, interstitial, or permission prompt between the FAB tap and the emergency sheet is a blocking defect.
- No dead ends (section 17.2). A mode chip with no confirmed match shows the nearest bathroom of any type with the explicit "not confirmed" disclaimer and a "Search more" action. Never an empty sheet, and never silent navigation to a non-qualifying place.
- Network failure keeps cached pins visible with the ERR-04 banner. A blocking spinner or blank map is a defect.
- GPS denied (ERR-01) opens manual address search. No hardcoded default city.
- Error copy is locked. Use the exact ERR string. ERR-09 stays generic: showing distance, spoofing, or "restricted" leaks anti-abuse and shadowban state (`PITFALLS.md` MODERATE-5) and is high severity.
- Backend changes count. An RPC that now raises instead of returning an empty set, a tighter GPS threshold, or a smaller result cap reaches the user as a blank map, a locked-out verify, or missing results. Trace it to the screen.

## Severity

A dead end, blocked or delayed emergency path, or anti-abuse leak is High or blocking. Friction that slows but does not stop the user is Medium. Say which ERR row or section 17 rule applies.

## Workflow

1. List every state the change can produce: loading, slow (ERR-05), empty, offline, denied, error, success.
2. For each, name the next action the user can take. None means a dead end.
3. Check sizes, placement, tap count, and copy against the sources, not general guidance.
4. For backend changes, name the screen and state each new failure mode produces.
