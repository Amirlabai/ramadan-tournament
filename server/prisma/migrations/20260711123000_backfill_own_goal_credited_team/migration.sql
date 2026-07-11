-- Backfill credited_team_id for legacy own goals that only had is_own_goal + member_id.
-- Credited team = opponent of the scorer's roster team in that match.

UPDATE goals AS g
SET credited_team_id = CASE
  WHEN p.team_id = m.team1_id THEN m.team2_id
  WHEN p.team_id = m.team2_id THEN m.team1_id
  ELSE g.credited_team_id
END
FROM matches AS m, players AS p
WHERE g.match_id = m.id
  AND g.season_id = m.season_id
  AND p.member_id = g.member_id
  AND p.season_id = g.season_id
  AND g.is_own_goal = true
  AND g.credited_team_id IS NULL
  AND g.member_id IS NOT NULL;
