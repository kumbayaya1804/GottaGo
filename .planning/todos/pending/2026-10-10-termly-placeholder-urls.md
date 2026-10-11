# Replace the Termly placeholder URLs in legal.ts before any user-facing build

Created: 2026-10-10, carried over from the retired Beads issue database (`gotta-go-cab`, opened 2026-07-03
by the project audit, priority 1, the only issue still open when the database was removed).

`app/src/constants/legal.ts` `LEGAL_URLS` still uses `policyUUID=PLACEHOLDER_TOS` and
`policyUUID=PLACEHOLDER_PRIVACY`. App Store and Play review reject placeholder legal links, so this blocks any
user-facing build.

Blocked on the user: the live policy UUIDs come from the Termly dashboard after the policy documents are
published. Once supplied, replace both placeholders (`app/src`, TDD, full tier) and check the links open.
