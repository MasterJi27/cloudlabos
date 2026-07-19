-- CloudLabOS Enterprise PostgreSQL Schema
-- Version: 1.0.0

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Users table
CREATE TABLE users (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email            VARCHAR(255) UNIQUE NOT NULL,
    name             VARCHAR(255),
    password_hash    TEXT,
    role             VARCHAR(50) DEFAULT 'viewer',
    oauth_provider   VARCHAR(50),
    oauth_sub        VARCHAR(255),
    settings         JSONB DEFAULT '{}',
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    last_login_at    TIMESTAMPTZ
);

-- Workspaces
CREATE TABLE workspaces (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name       VARCHAR(255) NOT NULL,
    owner_id   UUID REFERENCES users(id),
    settings   JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace members (RBAC)
CREATE TABLE workspace_members (
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    role         VARCHAR(50) DEFAULT 'viewer',
    PRIMARY KEY (workspace_id, user_id)
);

-- Workflows
CREATE TABLE workflows (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,
    name         VARCHAR(255) NOT NULL,
    description  TEXT,
    definition   JSONB NOT NULL,
    version      INT DEFAULT 1,
    status       VARCHAR(50) DEFAULT 'draft',
    created_by   UUID REFERENCES users(id),
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    updated_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_workflows_workspace ON workflows(workspace_id);

-- Workflow runs
CREATE TABLE workflow_runs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workflow_id     UUID REFERENCES workflows(id),
    workspace_id    UUID REFERENCES workspaces(id),
    status          VARCHAR(50) NOT NULL,
    trigger_type    VARCHAR(50),
    input_payload   JSONB DEFAULT '{}',
    output_payload  JSONB,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_runs_workflow ON workflow_runs(workflow_id);
CREATE INDEX idx_runs_status ON workflow_runs(status);

-- Run steps
CREATE TABLE run_steps (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id          UUID REFERENCES workflow_runs(id) ON DELETE CASCADE,
    step_name       VARCHAR(255) NOT NULL,
    agent_type      VARCHAR(50) NOT NULL,
    status          VARCHAR(50) NOT NULL,
    input_payload   JSONB,
    output_payload  JSONB,
    error_message   TEXT,
    risk_score      FLOAT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    retry_count     INT DEFAULT 0
);
CREATE INDEX idx_steps_run ON run_steps(run_id);

-- Approvals
CREATE TABLE approvals (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id         UUID REFERENCES workflow_runs(id),
    step_id        UUID REFERENCES run_steps(id),
    status         VARCHAR(50) DEFAULT 'pending',
    risk_score     FLOAT NOT NULL,
    risk_summary   TEXT,
    action_preview JSONB,
    requested_by   VARCHAR(100),
    reviewed_by    UUID REFERENCES users(id),
    review_notes   TEXT,
    expires_at     TIMESTAMPTZ,
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Memory items
CREATE TABLE memory_items (
    id            VARCHAR(255) PRIMARY KEY,
    workspace_id  VARCHAR(255) DEFAULT 'default',
    workflow_id   UUID,
    run_id        VARCHAR(255),
    content       TEXT NOT NULL,
    content_type  VARCHAR(50),
    metadata      JSONB DEFAULT '{}',
    tags          TEXT[] DEFAULT '{}',
    qdrant_id     VARCHAR(255),
    expires_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_memory_workspace ON memory_items(workspace_id);
CREATE INDEX idx_memory_run ON memory_items(run_id);
CREATE INDEX idx_memory_content_type ON memory_items(content_type);

-- Audit logs (append-only)
CREATE TABLE audit_logs (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID,
    user_id       UUID,
    agent_id      VARCHAR(100),
    action        VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id   VARCHAR(255),
    payload       JSONB,
    ip_address    INET,
    user_agent    TEXT,
    created_at    TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_audit_workspace ON audit_logs(workspace_id, created_at DESC);
CREATE INDEX idx_audit_action ON audit_logs(action);

-- Sessions
CREATE TABLE sessions (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id      UUID REFERENCES users(id) ON DELETE CASCADE,
    workspace_id UUID,
    token_hash   VARCHAR(255) NOT NULL UNIQUE,
    expires_at   TIMESTAMPTZ NOT NULL,
    created_at   TIMESTAMPTZ DEFAULT NOW(),
    last_used_at TIMESTAMPTZ
);

-- Plugins
CREATE TABLE plugins (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id  UUID REFERENCES workspaces(id),
    name          VARCHAR(255) NOT NULL,
    version       VARCHAR(50) NOT NULL,
    manifest      JSONB NOT NULL,
    status        VARCHAR(50) DEFAULT 'active',
    installed_by  UUID REFERENCES users(id),
    installed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Browser sessions
CREATE TABLE browser_sessions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id      UUID REFERENCES workflow_runs(id),
    session_id  VARCHAR(255) NOT NULL,
    status      VARCHAR(50) DEFAULT 'active',
    browser     VARCHAR(50) DEFAULT 'chromium',
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    closed_at   TIMESTAMPTZ
);
CREATE INDEX idx_browser_run ON browser_sessions(run_id);

-- Production databases start with no users or sample workflows. Create the
-- first account through the registration flow, then create a workspace. Demo
-- records belong in a separately invoked seed script, never in bootstrapping.
SELECT 'Database schema initialized successfully!' as status;
\i /docker-entrypoint-initdb.d/migrations/003_launch_readiness.sql
\i /docker-entrypoint-initdb.d/migrations/004_workflow_control_plane.sql
