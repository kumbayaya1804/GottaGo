# set_gps_consent reports success when it updates no row

Created: 2026-10-10 from a pre-review of the GPS consent batch. The lines are outside that batch.

`set_gps_consent` (`supabase/migrations/20260627000002_auth_rpcs.sql`) is a bare
`update users ... where id = auth.uid()` returning void. If no `users` row matches, it updates
nothing and returns no error, so the app treats consent as saved. The `handle_new_user` trigger
makes a missing row unlikely, but the client cannot tell the difference.

Fix in a database batch: `raise` when `not found`, with a pgTAP case for a caller without a
`users` row. New migration (never edit the applied one); both reviewers.
