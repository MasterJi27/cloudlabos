-- Workflow reliability and governance control plane.

CREATE TABLE IF NOT EXISTS workflow_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    definition JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(workflow_id, version)
);

CREATE TABLE IF NOT EXISTS workflow_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id UUID NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    cron_expression VARCHAR(255) NOT NULL,
    timezone VARCHAR(64) NOT NULL DEFAULT 'UTC',
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    input_payload JSONB NOT NULL DEFAULT '{}',
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS parent_run_id UUID REFERENCES workflow_runs(id);
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(255);
ALTER TABLE workflow_runs ADD COLUMN IF NOT EXISTS retry_of_step_id UUID REFERENCES run_steps(id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_runs_idempotency ON workflow_runs(workflow_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS execution_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    allowed_domains TEXT[] NOT NULL DEFAULT '{}',
    denied_commands TEXT[] NOT NULL DEFAULT '{}',
    approval_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.7,
    monthly_budget_cents BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS connector_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    provider VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    encrypted_secret BYTEA NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    rotated_at TIMESTAMPTZ,
    UNIQUE(workspace_id, provider, name)
);

CREATE TABLE IF NOT EXISTS workflow_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL,
    definition JSONB NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
