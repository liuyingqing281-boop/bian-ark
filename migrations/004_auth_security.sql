-- @add-column login_codes request_ip TEXT DEFAULT ''
-- @add-column login_codes locked_until TEXT DEFAULT ''

CREATE INDEX IF NOT EXISTS idx_login_codes_target_created
  ON login_codes(channel, target, created_at);
CREATE INDEX IF NOT EXISTS idx_login_codes_ip_created
  ON login_codes(request_ip, created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expires
  ON sessions(expires_at);
