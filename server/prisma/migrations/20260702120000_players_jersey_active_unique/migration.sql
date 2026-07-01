-- Drop full unique constraint so inactive roster rows do not block jersey reuse.
DROP INDEX "players_season_id_team_id_number_key";

-- Enforce jersey uniqueness only among active players on a team.
CREATE UNIQUE INDEX "players_season_id_team_id_number_active_key"
  ON "players"("season_id", "team_id", "number")
  WHERE ("active" = true);

-- Rollback (manual): DROP INDEX "players_season_id_team_id_number_active_key";
-- CREATE UNIQUE INDEX "players_season_id_team_id_number_key"
--   ON "players"("season_id", "team_id", "number");
-- Fails if inactive rows share a jersey on the same team.
