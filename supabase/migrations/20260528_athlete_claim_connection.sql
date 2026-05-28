-- Allow an authenticated user to claim an as-yet-unlinked athlete connection row.
--
-- The invite-code check is performed client-side (AthleteConnectPage validates
-- the code before showing the signup form). The RLS layer ensures only:
--   - The row is still unclaimed (athlete_auth_user_id IS NULL).
--   - The claiming user can only write their own auth uid into the row (WITH CHECK).
--
-- Once claimed, the existing "athlete_update_own_connection" policy takes over
-- (USING athlete_auth_user_id = auth.uid()) to allow future profile updates.
CREATE POLICY "athlete_claim_connection" ON athlete_connections
  FOR UPDATE
  USING  (athlete_auth_user_id IS NULL)
  WITH CHECK (athlete_auth_user_id = auth.uid());
