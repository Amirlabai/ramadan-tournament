UPDATE "teams"
SET "name" = 'Big Boss Crew'
WHERE "name" = 'מרוקו'
  AND "season_id" IN (
    SELECT "id"
    FROM "seasons"
    WHERE "division" = 'boys'
      AND "is_active" = true
  );
