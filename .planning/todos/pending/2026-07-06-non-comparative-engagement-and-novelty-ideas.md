---
created: 2026-07-06T05:01:15.689Z
title: Non-comparative engagement and novelty ideas
area: planning
files:
  - .planning/PROJECT.md:92-96 (Out of Scope — gamification deferral)
  - .planning/PROJECT.md:156 (Personal impact stat decision, Phase 5)
---

## Problem

User asked how to combat the classic two-sided-marketplace cold-start problem via user engagement/incentive design ("some type of dopamine inducing factor," "something like Pokémon Go... there has to be some type of novelty to it," "random facts around gut health"). Discussed on 2026-07-05/06, not yet decided or scoped into any phase — captured here to revisit later rather than act on now.

Important constraint already locked in `PROJECT.md`'s "Out of Scope (v1)" section: comparative/competitive gamification (leaderboards, points display, badges, rankings against other users) is explicitly deferred to v2. The only in-scope dopamine mechanic today is the private, non-comparative personal impact stat on the Profile screen (Phase 5). "Pokémon Go"-style novelty leans heavily on collection + competition + social comparison, which is in tension with that standing decision — flagged to the user directly; they chose to keep brainstorming rather than resolve the tension yet.

## Solution (ideas discussed, none decided/scoped)

- **Personal discovery log/journal** — private timeline of verified/visited locations, light completionist framing by location type (park, hotel lobby, chill spot, changing station). Collector-style novelty without leaderboards or public comparison.
- **Private streaks** — personal "N weeks active" tracking, visible only to the user, no public comparison, no shaming on reset.
- **Gut-health trivia facts** (user's idea) — "did you know..." style content shown during load/wait states (e.g. LocationDetail sheet loading spinner). On-brand, zero data/privacy surface, cheap to build as static/curated content — no schema or RPC changes implied.
- **Quiet aggregate social proof (not competitive)** — e.g. "12 people relied on this spot this month," an anonymous aggregate count that reinforces impact without ranking any individual.
- **Travel/regional badges, self-facing only** — e.g. "first verification in a new city" as a personal milestone, never shown publicly or comparatively.

All five are designed to stay compatible with the existing anti-gamification-comparison decision (private/personal reflection, not comparison/competition). Before any of these gets scoped into a real phase: (1) decide which (if any) are worth building, (2) decide which phase they'd land in (most likely Phase 5 alongside the personal impact stat, or Phase 8 Client UX polish), (3) resolve whether "novelty" the user still wants beyond these can be satisfied without revisiting the standing gamification-deferral decision, or whether that decision should be revisited (user explicitly did not choose to revisit it yet — chose "keep brainstorming" instead).
