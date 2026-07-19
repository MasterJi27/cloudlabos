-- CloudLabOS SaaS Features Migration
-- Version: 2.0.0
-- Adds multi-tenant SaaS tables: API keys, subscriptions, billing, webhooks, notifications, invitations, and usage tracking.

-- 1. API Keys
CREATE TABLE IF NOT EXISTS api_keys (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name          TEXT,
    key_hash      TEXT NOT NULL,
    last_used_at  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys(user_id);

-- 2. Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id           UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plan                   TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'enterprise')),
    status                 TEXT,
    stripe_customer_id     TEXT,
    stripe_subscription_id TEXT,
    current_period_start   TIMESTAMPTZ,
    current_period_end     TIMESTAMPTZ,
    trial_end              TIMESTAMPTZ,
    canceled_at            TIMESTAMPTZ,
    created_at             TIMESTAMPTZ DEFAULT NOW(),
    updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_workspace ON subscriptions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_customer_id);

-- 3. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id   UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    stripe_invoice_id TEXT,
    amount            INT,
    currency          TEXT DEFAULT 'usd',
    status            TEXT,
    paid_at           TIMESTAMPTZ,
    due_date          TIMESTAMPTZ,
    invoice_pdf       TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);

-- 4. Webhooks
CREATE TABLE IF NOT EXISTS webhooks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT,
    url           TEXT NOT NULL,
    secret        TEXT,
    events        TEXT[] NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhooks_workspace ON webhooks(workspace_id);

-- 5. Webhook Deliveries
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id       UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    event            TEXT,
    payload          JSONB,
    response_status  INT,
    response_body    TEXT,
    delivered_at     TIMESTAMPTZ,
    created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook ON webhook_deliveries(webhook_id);

-- 6. Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    workspace_id  UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    type          TEXT,
    title         TEXT,
    message       TEXT,
    data          JSONB,
    is_read       BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace ON notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id) WHERE is_read = FALSE;

-- 7. Workspace Invitations
CREATE TABLE IF NOT EXISTS workspace_invitations (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invited_by    UUID REFERENCES users(id),
    email         TEXT NOT NULL,
    role          TEXT DEFAULT 'viewer',
    token         TEXT UNIQUE NOT NULL,
    status        TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invitations_workspace ON workspace_invitations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_invitations_token ON workspace_invitations(token);
CREATE INDEX IF NOT EXISTS idx_invitations_email ON workspace_invitations(email);

-- 8. Add MFA and email verification columns to users
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret        TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled       BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_token TEXT;

-- 9. Usage Records
CREATE TABLE IF NOT EXISTS usage_records (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    metric        TEXT NOT NULL CHECK (metric IN ('runs', 'storage', 'api_calls')),
    value         BIGINT DEFAULT 0,
    recorded_at   DATE DEFAULT CURRENT_DATE
);

-- 10. Unique constraint on usage_records
CREATE UNIQUE INDEX IF NOT EXISTS idx_usage_records_unique
    ON usage_records(workspace_id, metric, recorded_at);

CREATE INDEX IF NOT EXISTS idx_usage_records_workspace ON usage_records(workspace_id);
