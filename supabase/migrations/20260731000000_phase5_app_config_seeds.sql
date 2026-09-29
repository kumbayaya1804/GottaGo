-- Phase 5 (05-02 Task 2b) — new app_config tunables locked at the 05-02 Task 1
-- decision checkpoint (2026-07-31).
--
-- Analog: 20260704010001_phase3_max_pins_config.sql (seed idiom — `value` is TEXT,
-- RPCs read with `coalesce()`).
--
-- ONLY NEW KEYS ARE INSERTED. The following keys are ALREADY seeded and are
-- deliberately NOT re-inserted or altered here (a duplicate-key insert would abort
-- the migration, and silently changing them would corrupt shipped behavior):
--
--   submission_publish_threshold = 2     (20260519010000, baseline)
--   max_accuracy_m               = 50    (20260519020000)
--   verify_radius_m              = 100   (20260519020000)
--   max_gps_age_s                = 60    (20260519020000)
--   decay_half_life_days         = 30    (20260519020000)
--   confidence_floor             = 0.05  (20260519020000)
--   report_suppress_threshold    = 4     (20260519020000)
--   max_pins_per_viewport        = 200   (20260704010001)
--
-- `on conflict (key) do nothing` guards the insert regardless: re-running this
-- migration, or running it against a database where an operator hand-seeded one of
-- these keys, is a no-op rather than a hard failure.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- TWO RADII, BOTH SERVER-ENFORCED — do not conflate (05-02 Task 1)
-- ─────────────────────────────────────────────────────────────────────────────
--   verify_radius_m    = 100  HARD PROXIMITY GATE. verify_location rejects outright
--                             when the server-computed distance exceeds it. Already
--                             seeded; NOT touched here.
--   discovery_radius_m = 500  Discovery radius AND the D-56 linear weight-decay span.
--                             NEW key — verify_radius_m must never be repurposed for
--                             this, which is why a distinct key exists.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- TWO ACCURACY BOUNDS — the Task-1 "Finding 1" fix
-- ─────────────────────────────────────────────────────────────────────────────
-- The 05-02 plan's drafted defaults proposed accuracy_floor_m=100 (hard reject) with
-- the decay span reusing max_accuracy_m=50. That pairing is INVERTED relative to the
-- proximity pair and produces a silent dead zone: with
-- accuracy_decay = greatest(0, 1 - accuracy_m / span), any fix with accuracy in
-- [50, 100] passes the 100m hard reject but computes accuracy_decay = 0, hence
-- weight = 0. A weight-0 event is accepted, counts toward nothing, earns no trust,
-- and — because of D-43's verification_events_user_submission_uniq index — burns the
-- user's ONE event slot for that submission permanently (verify_location's duplicate
-- conflict path returns accepted=true with no side effect). That outcome is
-- indistinguishable from a shadowbanned event and strictly worse than a rejection,
-- which would at least let the user retry with a better fix.
--
-- Locked resolution (user-approved, 05-02 Task 1): mirror the proximity design, where
-- the hard gate is strictly TIGHTER than the decay span.
--
--   accuracy_floor_m       = 50   HARD ACCURACY REJECT (D-46). New key.
--   accuracy_decay_span_m  = 100  Linear accuracy-decay span. New key.
--
-- Admitted accuracies are therefore [0, 50] → accuracy_decay ∈ [0.5, 1.0], never 0.
-- Compare the proximity pair: admitted distances [0, 100] over a 500m span →
-- proximity_decay ∈ [0.8, 1.0], never 0. Both pairs are now well-formed.
--
-- max_accuracy_m (50) is left ALONE and keeps its single existing meaning:
-- submit_location's hard accuracy reject. It is deliberately NOT reused as a decay
-- span — doing so would overload one key across two RPCs with different semantics,
-- so an admin loosening it for submissions would silently widen verification's decay
-- curve. Setting accuracy_floor_m to the same 50 value also means verification and
-- submission share one accuracy bar, rather than verification (the fraud-sensitive
-- physical-presence proof) accepting sloppier GPS than submission does.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- CONFIDENCE SCALE NOTE (cross-phase, for 06's decay job)
-- ─────────────────────────────────────────────────────────────────────────────
-- The already-seeded confidence_floor = 0.05 is on a 0-1 scale ("locations never
-- decay to zero"). Phase 5 establishes locations.confidence_value on a 0-100 scale,
-- on which 0.05 is effectively zero and would defeat that guarantee. Rather than
-- mutate the shipped key (forbidden by this task, and it may have other readers), a
-- NEW scale-matched key is seeded here for Phase 6's decay job to consume.
-- confidence_floor is retained untouched and is superseded for 0-100 math.

insert into public.app_config (key, value, description) values
  -- Discovery + weight decay -------------------------------------------------
  ('discovery_radius_m',           '500',
   'Discovery radius AND D-56 linear proximity-decay span, in meters. DISTINCT from verify_radius_m (100), which is the hard proximity reject gate. Both are server-enforced (D-35/D-56).'),
  ('verify_cooldown_s',            '3',
   'Per-user cooldown between verification/discovery attempts, in seconds. A REJECTED attempt still consumes it (D-36). Matches the coalesce fallback 05-01''s search_pending_submissions_nearby already ships.'),

  -- Accuracy gate + decay span (Task-1 Finding 1 fix) ------------------------
  ('accuracy_floor_m',             '50',
   'HARD GPS-accuracy reject floor for verify_location, in meters (D-46). Deliberately equal to max_accuracy_m so verification and submission share one accuracy bar. Must stay STRICTLY TIGHTER than accuracy_decay_span_m or admitted events can compute weight=0 and silently burn the D-43 one-event-per-submission slot.'),
  ('accuracy_decay_span_m',        '100',
   'Linear accuracy-decay span, in meters: accuracy_decay = greatest(0, 1 - accuracy_m / this). Kept LOOSER than accuracy_floor_m so every admitted event has a strictly positive accuracy_decay (mirrors the verify_radius_m=100 gate inside the discovery_radius_m=500 span).'),

  -- Numeric confidence authority (D-53/D-54/D-55) ----------------------------
  ('confidence_high_threshold',    '70',
   'locations.confidence_value >= this derives confidence tier ''High'' (D-54). 0-100 scale.'),
  ('confidence_medium_threshold',  '40',
   'locations.confidence_value >= this (and < confidence_high_threshold) derives ''Medium''; below it derives ''Low'' (D-54). 0-100 scale.'),
  ('confidence_publish_start',     '50',
   'confidence_value assigned to a location at the moment it publishes — deliberately MID-tier, not maximum, so confidence still visibly rises with continued verification (D-55).'),
  ('confidence_floor_value',       '5',
   'Minimum confidence_value on the 0-100 scale; locations never decay to zero (Phase 6 decay job). Scale-matched successor to the 0-1-scale confidence_floor=0.05, which is retained untouched but is NOT valid for 0-100 math.'),

  -- Trust engine (D-48/D-49) -------------------------------------------------
  ('trust_multiplier_step',        '0.05',
   'users.trust_multiplier ramp per ACCEPTED nonzero-weight verification GIVEN, from the 0.5 floor toward the 1.0 ceiling (D-48) — 10 accepted verifications to reach max. Distinct axis from trust_score. Consumed by verify_location step 7b.'),

  -- Raw-GPS retention (D-40) -------------------------------------------------
  ('raw_gps_retention_days',       '30',
   'Retention window in days for the raw GPS coordinate (verification_events.gps_location) before purge; derived distance/accuracy/weight are kept permanently (D-40). Consumed by verify_location/submit_location when computing raw_gps_purge_after, and by the 05-06 backfill of legacy NULL deadlines. verify_location''s coalesce fallback MUST equal this seeded value.')
on conflict (key) do nothing;
