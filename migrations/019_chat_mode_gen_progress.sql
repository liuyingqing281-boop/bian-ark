-- 019：W3 想念双模式 + W6 生图异步进度
-- chat_messages.mode：companion（第三方，默认）| roleplay（模仿）
-- @add-column chat_messages mode TEXT DEFAULT 'companion'

-- ai_generation_jobs 进度：completed/total，前端轮询渲染百分比
-- @add-column ai_generation_jobs total INTEGER DEFAULT 4
-- @add-column ai_generation_jobs completed INTEGER DEFAULT 0
