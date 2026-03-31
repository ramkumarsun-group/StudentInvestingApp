-- Partial unique index for OAuth provider lookups.
-- Enforces uniqueness only where oauth_provider is set, allowing
-- multiple rows with oauth_provider = NULL (email/password users).
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;
