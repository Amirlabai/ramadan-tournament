-- Own goals: anonymous scorers + credited team; technical win flag on matches

ALTER TABLE "matches" ADD COLUMN "technical_winner_team_id" INTEGER;

ALTER TABLE "goals" ALTER COLUMN "member_id" DROP NOT NULL;
ALTER TABLE "goals" ADD COLUMN "credited_team_id" INTEGER;
