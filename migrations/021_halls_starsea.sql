-- 021 星海择位（docs/09 M9，墓园规格 §8）
-- halls 园级坐标；in_garden=1 必须 visibility='public'（应用层强制）
-- @add-column halls in_garden INTEGER DEFAULT 0
-- @add-column halls garden_x REAL
-- @add-column halls garden_y REAL
-- @add-column halls garden_zone TEXT DEFAULT 'public'
CREATE INDEX IF NOT EXISTS idx_halls_garden ON halls (in_garden, garden_zone);
