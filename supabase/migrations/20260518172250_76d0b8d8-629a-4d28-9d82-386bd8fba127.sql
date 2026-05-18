ALTER TABLE public.monsters ADD COLUMN IF NOT EXISTS team_position smallint NOT NULL DEFAULT 0;
-- Seed positions for existing team members based on creation order per owner
WITH ranked AS (
  SELECT id, row_number() OVER (PARTITION BY owner_id ORDER BY created_at) - 1 AS pos
  FROM public.monsters
  WHERE in_team = true
)
UPDATE public.monsters m
SET team_position = LEAST(ranked.pos, 2)
FROM ranked
WHERE m.id = ranked.id;