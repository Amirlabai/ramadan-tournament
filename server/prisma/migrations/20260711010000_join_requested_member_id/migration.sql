-- Persist claimed roster slot on the join request so prior-claim history
-- survives playerProfile overwrites after approve / re-request.
ALTER TABLE "team_join_requests" ADD COLUMN "requested_member_id" INTEGER;

CREATE INDEX "team_join_requests_season_id_team_id_requested_member_id_idx"
  ON "team_join_requests"("season_id", "team_id", "requested_member_id");
