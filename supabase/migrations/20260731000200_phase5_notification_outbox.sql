-- Phase 5 (05-02 Task 2c) — notification_outbox: the publication-notification queue.
-- (2026-07-31)
--
-- This plan creates the table because the atomic publish transaction (05-02 Task 3)
-- is its PRODUCER — the enqueue happens inside the same transaction as the locations
-- insert, so the table must exist before verify_location can be defined. The
-- CONSUMER (a service-only claim/settle RPC pair plus the Edge Function that drains
-- it) is 05-05 scope and is deliberately NOT created here.
--
-- D-67: the recipient is the submission CREATOR ONLY. Verifiers are never notified;
-- their feedback loop is the D-65 personal impact stat. The schema enforces this
-- shape by carrying exactly one recipient column, not a recipient set.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT THE UNIQUE KEY DOES AND DOES NOT PROMISE
-- ─────────────────────────────────────────────────────────────────────────────
-- `unique (submission_id)` makes ENQUEUE idempotent: a retried or concurrent publish
-- transaction cannot create a second queue row for the same submission. It does NOT
-- promise exactly-once DELIVERY across Expo's external boundary — that is not
-- achievable from inside a database transaction. The delivery-state columns below
-- bound and observe the at-least-once behavior instead.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DELIVERY-STATE MODEL (what 05-05's worker needs to be crash-safe)
-- ─────────────────────────────────────────────────────────────────────────────
-- claimed_at / claim_token / claim_expires_at — a LEASE, not a lock. A worker claims
--   a row by stamping a fresh claim_token and a claim_expires_at deadline. If that
--   worker crashes, the lease EXPIRES and the row becomes claimable again, so a row
--   can never be stranded by a dead worker. Settlement in 05-05 must be a
--   COMPARE-AND-SET on (id, claim_token): a stale worker whose lease was already
--   reclaimed by someone else will not match the current token and therefore cannot
--   clobber the newer worker's outcome.
-- attempt_count / max_attempts / failed_at — BOUNDED retries with a terminal state.
--   Without a terminal state a permanently failing row (e.g. a revoked push token)
--   retries forever and the queue never drains. failed_at is that terminal marker.
-- next_attempt_at — backoff scheduling; a row is not due before this.
-- expo_ticket_id / ticket_created_at / receipt_checked_at — Expo's push API is
--   two-phase: send returns a TICKET, and the RECEIPT must be fetched later to learn
--   the real outcome (including DeviceNotRegistered, which 05-05 uses to revoke a
--   dead token). Both phases need their own timestamps.
-- delivered_at — the success terminal state.
-- last_error — operator diagnostics for a failing row.

create table if not exists public.notification_outbox (
  id                 uuid primary key default gen_random_uuid(),

  -- Enqueue identity + payload targets ---------------------------------------
  -- submission_id is the idempotency key (one queue row per published submission).
  submission_id      uuid not null references public.submissions(id) on delete cascade,
  location_id        uuid references public.locations(id) on delete cascade,
  -- D-67: creator only. Cascade-delete so a deleted account leaves no queued push.
  recipient_user_id  uuid not null references public.users(id) on delete cascade,
  created_at         timestamptz not null default now(),

  -- Claim lease (crashed-worker recovery) ------------------------------------
  claimed_at         timestamptz,
  claim_token        uuid,
  claim_expires_at   timestamptz,

  -- Bounded retry + terminal failure -----------------------------------------
  attempt_count      integer not null default 0,
  max_attempts       integer not null default 5,
  next_attempt_at    timestamptz not null default now(),
  failed_at          timestamptz,
  last_error         text,

  -- Expo two-phase delivery state --------------------------------------------
  expo_ticket_id     text,
  ticket_created_at  timestamptz,
  receipt_checked_at timestamptz,
  delivered_at       timestamptz,

  constraint notification_outbox_submission_uniq unique (submission_id),
  constraint notification_outbox_attempts_nonneg check (attempt_count >= 0),
  constraint notification_outbox_max_attempts_pos check (max_attempts > 0),
  -- A claim is either fully absent or fully present; a half-stamped claim would let
  -- the consumer's compare-and-set settle against a null token.
  constraint notification_outbox_claim_coherent check (
    (claimed_at is null and claim_token is null and claim_expires_at is null)
    or
    (claimed_at is not null and claim_token is not null and claim_expires_at is not null)
  )
);

comment on table public.notification_outbox is
  'Publication-notification queue (D-66/D-67). PRODUCER is the 05-02 verify_location publish transaction; CONSUMER is the 05-05 service-only claim/settle RPCs + drain Edge Function. unique(submission_id) guarantees idempotent ENQUEUE only, never exactly-once external delivery.';

-- FK indexes (PostgreSQL does not create these automatically).
-- submission_id already has a unique index from notification_outbox_submission_uniq.
create index if not exists idx_notification_outbox_location_id
  on public.notification_outbox (location_id);
create index if not exists idx_notification_outbox_recipient
  on public.notification_outbox (recipient_user_id);

-- Due/claimable predicate index. The full runtime predicate the 05-05 worker uses is
--   failed_at is null                      -- not terminally failed
--   and delivered_at is null               -- not already delivered
--   and next_attempt_at <= now()           -- backoff elapsed
--   and (claimed_at is null                -- unclaimed
--        or claim_expires_at <= now())     -- OR lease expired (crashed worker)
-- Index predicates cannot reference now() (not IMMUTABLE), so the two time
-- comparisons stay in the query while the two stable booleans form the partial-index
-- predicate; the leading columns then serve the range scan and the ordering.
create index if not exists idx_notification_outbox_due
  on public.notification_outbox (next_attempt_at, claim_expires_at)
  where failed_at is null and delivered_at is null;

-- ═══════════════════════════════════════════════════════════════════════════════
-- Least privilege
-- ═══════════════════════════════════════════════════════════════════════════════
alter table public.notification_outbox enable row level security;

-- NO client access at all — not even recipient-scoped SELECT. The D-68 in-app
-- "Published!" fallback is served by the owner-scoped
-- get_my_unseen_submission_publications / acknowledge_submission_publication RPCs
-- (05-02 Task 3), NOT by reading this queue, so exposing it would widen the attack
-- surface for zero product benefit. Only service_role and the SECURITY DEFINER
-- publish/drain RPCs (which run as the table owner) touch this table.
revoke all privileges on table public.notification_outbox from anon, authenticated;

create policy "notification_outbox_service_all"
  on public.notification_outbox for all
  using ((auth.jwt() ->> 'role') = 'service_role');
