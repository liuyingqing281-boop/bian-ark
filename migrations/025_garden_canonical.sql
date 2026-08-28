-- 025 星海馆级 canonical ID：halls 是园级空间单位，memorials 是馆内人物。
UPDATE memorials
SET hall_id = 'hall_' || id
WHERE COALESCE(hall_id, '') = ''
  AND EXISTS (SELECT 1 FROM halls h WHERE h.id = 'hall_' || memorials.id);

CREATE INDEX IF NOT EXISTS idx_memorials_hall_public
  ON memorials (hall_id, is_published, created_at);

CREATE INDEX IF NOT EXISTS idx_halls_garden_lookup
  ON halls (in_garden, visibility, garden_zone, garden_x, garden_y);
