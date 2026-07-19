-- CloudLabOS - Seed Data for Screenshots
-- Run after init.sql: psql -U cloudlabos -d cloudlabos -f seed-data.sql

-- ============================================
-- Users
-- ============================================
INSERT INTO users (email, name, password_hash, role, settings) VALUES
    ('sarah.chen@cloudlabos.ai', 'Sarah Chen', '$2b$12$j9/r05UoitX20V7sVEGw2O/91Ee7p64FFNC7ljll5BGwIpoPJhN.i', 'admin', '{"theme": "dark", "notifications": true}'),
    ('marcus.johnson@cloudlabos.ai', 'Marcus Johnson', '$2b$12$j9/r05UoitX20V7sVEGw2O/91Ee7p64FFNC7ljll5BGwIpoPJhN.i', 'operator', '{"theme": "dark"}'),
    ('priya.patel@cloudlabos.ai', 'Priya Patel', '$2b$12$j9/r05UoitX20V7sVEGw2O/91Ee7p64FFNC7ljll5BGwIpoPJhN.i', 'operator', '{"theme": "dark"}'),
    ('alex.kim@cloudlabos.ai', 'Alex Kim', '$2b$12$j9/r05UoitX20V7sVEGw2O/91Ee7p64FFNC7ljll5BGwIpoPJhN.i', 'viewer', '{"theme": "light"}'),
    ('jordan.smith@cloudlabos.ai', 'Jordan Smith', '$2b$12$j9/r05UoitX20V7sVEGw2O/91Ee7p64FFNC7ljll5BGwIpoPJhN.i', 'operator', '{"theme": "dark"}')
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- Workspaces
-- ============================================
INSERT INTO workspaces (id, name, owner_id) VALUES
    ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Production', (SELECT id FROM users WHERE email = 'admin@cloudlabos.ai')),
    ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Staging', (SELECT id FROM users WHERE email = 'admin@cloudlabos.ai')),
    ('c3d4e5f6-a7b8-9012-cdef-123456678902', 'Data Pipeline', (SELECT id FROM users WHERE email = 'sarah.chen@cloudlabos.ai'))
ON CONFLICT DO NOTHING;

-- Add members to workspaces
INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id, 'admin' FROM users WHERE email = 'admin@cloudlabos.ai'
ON CONFLICT DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id, 'operator' FROM users WHERE email = 'sarah.chen@cloudlabos.ai'
ON CONFLICT DO NOTHING;

INSERT INTO workspace_members (workspace_id, user_id, role)
SELECT 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', id, 'operator' FROM users WHERE email = 'marcus.johnson@cloudlabos.ai'
ON CONFLICT DO NOTHING;

-- ============================================
-- Workflows (various statuses)
-- ============================================
INSERT INTO workflows (workspace_id, name, description, definition, status, version, created_by) VALUES
('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Customer Onboarding Pipeline',
 'Automated customer onboarding with document verification and account setup',
 '{"name":"Customer Onboarding Pipeline","version":"2.1.0","timeout_s":600,"approval_mode":"policy","steps":[{"name":"validate_documents","agent_type":"vision","timeout_s":120},{"name":"run_kyc_check","agent_type":"execution","timeout_s":180},{"name":"create_account","agent_type":"execution","timeout_s":60},{"name":"send_welcome_email","agent_type":"execution","timeout_s":30},{"name":"verify_setup","agent_type":"validation","timeout_s":60}]}',
 'active', 3, (SELECT id FROM users WHERE email = 'admin@cloudlabos.ai')),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Security Audit Scanner',
 'Daily security vulnerability scan across all microservices',
 '{"name":"Security Audit Scanner","version":"1.4.0","timeout_s":900,"approval_mode":"always","steps":[{"name":"scan_dependencies","agent_type":"security","timeout_s":300},{"name":"check_configurations","agent_type":"security","timeout_s":180},{"name":"analyze_network","agent_type":"execution","timeout_s":240},{"name":"generate_report","agent_type":"planner","timeout_s":120}]}',
 'active', 5, (SELECT id FROM users WHERE email = 'sarah.chen@cloudlabos.ai')),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Market Research Agent',
 'Automated market research with web scraping and analysis',
 '{"name":"Market Research Agent","version":"1.0.0","timeout_s":1200,"approval_mode":"never","steps":[{"name":"scrape_sources","agent_type":"research","timeout_s":600},{"name":"analyze_sentiment","agent_type":"planner","timeout_s":300},{"name":"compile_report","agent_type":"validation","timeout_s":180}]}',
 'active', 1, (SELECT id FROM users WHERE email = 'marcus.johnson@cloudlabos.ai')),

('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Regression Test Suite',
 'Full regression test with browser automation',
 '{"name":"Regression Test Suite","version":"3.0.0","timeout_s":1800,"approval_mode":"policy","steps":[{"name":"setup_environment","agent_type":"execution","timeout_s":120},{"name":"run_e2e_tests","agent_type":"execution","timeout_s":900},{"name":"capture_screenshots","agent_type":"vision","timeout_s":300},{"name":"compare_results","agent_type":"validation","timeout_s":180}]}',
 'active', 7, (SELECT id FROM users WHERE email = 'priya.patel@cloudlabos.ai')),

('c3d4e5f6-a7b8-9012-cdef-123456678902', 'ETL Data Pipeline',
 'Extract, transform, and load data from multiple sources',
 '{"name":"ETL Data Pipeline","version":"2.0.0","timeout_s":3600,"approval_mode":"policy","steps":[{"name":"extract_api_data","agent_type":"research","timeout_s":600},{"name":"transform_records","agent_type":"execution","timeout_s":900},{"name":"validate_data","agent_type":"validation","timeout_s":300},{"name":"load_to_warehouse","agent_type":"execution","timeout_s":600}]}',
 'active', 4, (SELECT id FROM users WHERE email = 'sarah.chen@cloudlabos.ai')),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'AI Content Generator',
 'Generate marketing content using LLM agents',
 '{"name":"AI Content Generator","version":"0.1.0","timeout_s":300,"steps":[{"name":"research_topic","agent_type":"research","timeout_s":120},{"name":"generate_draft","agent_type":"planner","timeout_s":180}]}',
 'draft', 1, (SELECT id FROM users WHERE email = 'alex.kim@cloudlabos.ai')),

('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Compliance Checker',
 'Automated regulatory compliance verification',
 '{"name":"Compliance Checker","version":"0.2.0","timeout_s":600,"steps":[{"name":"load_requirements","agent_type":"research","timeout_s":120},{"name":"check_policies","agent_type":"security","timeout_s":300},{"name":"generate_report","agent_type":"planner","timeout_s":180}]}',
 'draft', 1, (SELECT id FROM users WHERE email = 'jordan.smith@cloudlabos.ai')),

('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'Legacy Import Tool',
 'Deprecated data import tool - replaced by ETL Pipeline',
 '{"name":"Legacy Import Tool","version":"1.0.0","steps":[{"name":"import_csv","agent_type":"execution","timeout_s":300}]}',
 'archived', 1, (SELECT id FROM users WHERE email = 'admin@cloudlabos.ai'));

-- ============================================
-- Workflow Runs (various statuses)
-- ============================================

-- Running workflows
INSERT INTO workflow_runs (id, workflow_id, workspace_id, status, trigger_type, started_at)
VALUES
    ('660e8400-e29b-41d4-a716-446655440001',
     (SELECT id FROM workflows WHERE name = 'Customer Onboarding Pipeline' LIMIT 1),
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     'running', 'api', NOW() - interval '12 minutes'),
    ('660e8400-e29b-41d4-a716-446655440002',
     (SELECT id FROM workflows WHERE name = 'Security Audit Scanner' LIMIT 1),
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     'running', 'schedule', NOW() - interval '8 minutes'),
    ('660e8400-e29b-41d4-a716-446655440003',
     (SELECT id FROM workflows WHERE name = 'Market Research Agent' LIMIT 1),
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     'running', 'manual', NOW() - interval '3 minutes');

-- Successful runs
INSERT INTO workflow_runs (id, workflow_id, workspace_id, status, trigger_type, started_at, completed_at)
VALUES
    ('660e8400-e29b-41d4-a716-446655440011',
     (SELECT id FROM workflows WHERE name = 'Customer Onboarding Pipeline' LIMIT 1),
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     'success', 'api', NOW() - interval '2 hours', NOW() - interval '1 hour 55 minutes'),
    ('660e8400-e29b-41d4-a716-446655440012',
     (SELECT id FROM workflows WHERE name = 'Regression Test Suite' LIMIT 1),
     'b2c3d4e5-f6a7-8901-bcde-f12345678901',
     'success', 'schedule', NOW() - interval '1 hour', NOW() - interval '42 minutes'),
    ('660e8400-e29b-41d4-a716-446655440013',
     (SELECT id FROM workflows WHERE name = 'ETL Data Pipeline' LIMIT 1),
     'c3d4e5f6-a7b8-9012-cdef-123456678902',
     'success', 'manual', NOW() - interval '30 minutes', NOW() - interval '18 minutes'),
    ('660e8400-e29b-41d4-a716-446655440014',
     (SELECT id FROM workflows WHERE name = 'Security Audit Scanner' LIMIT 1),
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     'success', 'schedule', NOW() - interval '6 hours', NOW() - interval '5 hours 50 minutes'),
    ('660e8400-e29b-41d4-a716-446655440015',
     (SELECT id FROM workflows WHERE name = 'Customer Onboarding Pipeline' LIMIT 1),
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     'success', 'api', NOW() - interval '1 day', NOW() - interval '23 hours 55 minutes');

-- Failed runs
INSERT INTO workflow_runs (id, workflow_id, workspace_id, status, trigger_type, started_at, completed_at)
VALUES
    ('660e8400-e29b-41d4-a716-446655440021',
     (SELECT id FROM workflows WHERE name = 'ETL Data Pipeline' LIMIT 1),
     'c3d4e5f6-a7b8-9012-cdef-123456678902',
     'failed', 'schedule', NOW() - interval '4 hours', NOW() - interval '3 hours 52 minutes'),
    ('660e8400-e29b-41d4-a716-446655440022',
     (SELECT id FROM workflows WHERE name = 'Regression Test Suite' LIMIT 1),
     'b2c3d4e5-f6a7-8901-bcde-f12345678901',
     'failed', 'manual', NOW() - interval '2 days', NOW() - interval '2 days 10 minutes');

-- Paused run (awaiting approval)
INSERT INTO workflow_runs (id, workflow_id, workspace_id, status, trigger_type, started_at)
VALUES
    ('660e8400-e29b-41d4-a716-446655440031',
     (SELECT id FROM workflows WHERE name = 'Security Audit Scanner' LIMIT 1),
     'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
     'paused', 'api', NOW() - interval '45 minutes');

-- ============================================
-- Run Steps
-- ============================================

-- Steps for running Customer Onboarding run
INSERT INTO run_steps (run_id, step_name, agent_type, status, started_at, risk_score)
VALUES
    ('660e8400-e29b-41d4-a716-446655440001', 'validate_documents', 'vision', 'success', NOW() - interval '12 minutes', 0.2),
    ('660e8400-e29b-41d4-a716-446655440001', 'run_kyc_check', 'execution', 'success', NOW() - interval '10 minutes', 0.6),
    ('660e8400-e29b-41d4-a716-446655440001', 'create_account', 'execution', 'running', NOW() - interval '5 minutes', 0.3);

-- Steps for running Security Audit run
INSERT INTO run_steps (run_id, step_name, agent_type, status, started_at, risk_score)
VALUES
    ('660e8400-e29b-41d4-a716-446655440002', 'scan_dependencies', 'security', 'success', NOW() - interval '8 minutes', 0.4),
    ('660e8400-e29b-41d4-a716-446655440002', 'check_configurations', 'security', 'running', NOW() - interval '3 minutes', 0.7);

-- Steps for successful run
INSERT INTO run_steps (run_id, step_name, agent_type, status, started_at, completed_at, risk_score)
VALUES
    ('660e8400-e29b-41d4-a716-446655440011', 'validate_documents', 'vision', 'success', NOW() - interval '2 hours', NOW() - interval '1 hour 59 minutes', 0.2),
    ('660e8400-e29b-41d4-a716-446655440011', 'run_kyc_check', 'execution', 'success', NOW() - interval '1 hour 59 minutes', NOW() - interval '1 hour 57 minutes', 0.6),
    ('660e8400-e29b-41d4-a716-446655440011', 'create_account', 'execution', 'success', NOW() - interval '1 hour 57 minutes', NOW() - interval '1 hour 56 minutes', 0.1),
    ('660e8400-e29b-41d4-a716-446655440011', 'send_welcome_email', 'execution', 'success', NOW() - interval '1 hour 56 minutes', NOW() - interval '1 hour 55 minutes 30 seconds', 0.0),
    ('660e8400-e29b-41d4-a716-446655440011', 'verify_setup', 'validation', 'success', NOW() - interval '1 hour 55 minutes 30 seconds', NOW() - interval '1 hour 55 minutes', 0.1);

-- Steps for failed ETL run
INSERT INTO run_steps (run_id, step_name, agent_type, status, started_at, completed_at, risk_score, error_message)
VALUES
    ('660e8400-e29b-41d4-a716-446655440021', 'extract_api_data', 'research', 'success', NOW() - interval '4 hours', NOW() - interval '3 hours 56 minutes', 0.3, NULL),
    ('660e8400-e29b-41d4-a716-446655440021', 'transform_records', 'execution', 'failed', NOW() - interval '3 hours 56 minutes', NOW() - interval '3 hours 52 minutes', 0.5, 'Timeout: transform step exceeded 600s limit. Memory usage peaked at 2.1GB.');

-- Steps for paused run
INSERT INTO run_steps (run_id, step_name, agent_type, status, started_at, risk_score)
VALUES
    ('660e8400-e29b-41d4-a716-446655440031', 'scan_dependencies', 'security', 'success', NOW() - interval '45 minutes', 0.4),
    ('660e8400-e29b-41d4-a716-446655440031', 'check_configurations', 'security', 'success', NOW() - interval '40 minutes', 0.7),
    ('660e8400-e29b-41d4-a716-446655440031', 'analyze_network', 'execution', 'pending', NULL, 0.9);

-- ============================================
-- Approvals (using correct schema)
-- ============================================
INSERT INTO approvals (run_id, step_id, status, risk_score, risk_summary, action_preview, requested_by, created_at)
VALUES
    ('660e8400-e29b-41d4-a716-446655440031',
     (SELECT id FROM run_steps WHERE run_id = '660e8400-e29b-41d4-a716-446655440031' AND step_name = 'analyze_network' LIMIT 1),
     'pending', 0.9,
     'Execute network vulnerability scan on production cluster. This action requires manual approval due to high risk score.',
     '{"action": "execute_network_scan", "target": "production-cluster", "risk_score": 0.9}',
     'Security Audit Scanner',
     NOW() - interval '38 minutes'),
    ('660e8400-e29b-41d4-a716-446655440001',
     (SELECT id FROM run_steps WHERE run_id = '660e8400-e29b-41d4-a716-446655440001' AND step_name = 'create_account' LIMIT 1),
     'pending', 0.7,
     'Create user account with admin privileges for new enterprise client. Requires approval for privileged access.',
     '{"action": "create_account", "privileges": "admin", "client": "enterprise"}',
     'Customer Onboarding Pipeline',
     NOW() - interval '5 minutes');

INSERT INTO approvals (run_id, step_id, status, risk_score, risk_summary, action_preview, requested_by, reviewed_by, review_notes, created_at, updated_at)
VALUES
    ('660e8400-e29b-41d4-a716-446655440012',
     (SELECT id FROM run_steps WHERE run_id = '660e8400-e29b-41d4-a716-446655440012' AND step_name = 'compare_results' LIMIT 1),
     'approved', 0.8,
     'Override test baseline and mark as passing. Historical flaky test pattern confirmed.',
     '{"action": "override_baseline", "test_id": "payment-flow-003"}',
     'Regression Test Suite',
     (SELECT id FROM users WHERE email = 'admin@cloudlabos.ai'),
     'Reviewed flaky test history. Pattern confirmed - safe to approve.',
     NOW() - interval '48 minutes', NOW() - interval '45 minutes');

-- ============================================
-- Memory Items (with explicit IDs)
-- ============================================
INSERT INTO memory_items (id, run_id, content, content_type, metadata, tags)
VALUES
    ('mem-001',
     (SELECT id FROM workflow_runs WHERE status = 'success' LIMIT 1),
     'Customer onboarding pipeline completed successfully. New enterprise client Acme Corp onboarded with 5 seats. KYC verification passed. Account created with standard tier permissions.',
     'summary',
     '{"agent": "orchestrator", "importance": "high"}',
     ARRAY['onboarding', 'enterprise', 'success']),

    ('mem-002',
     (SELECT id FROM workflow_runs WHERE status = 'success' LIMIT 1),
     'Security scan found 2 medium-severity vulnerabilities in api-gateway dependencies: CVE-2024-1234 in urllib3, CVE-2024-5678 in certifi. Recommended upgrade to urllib3>=2.1.0 and certifi>=2024.2.0.',
     'finding',
     '{"agent": "security", "severity": "medium", "cve_count": 2}',
     ARRAY['security', 'vulnerability', 'dependencies']),

    ('mem-003',
     (SELECT id FROM workflow_runs WHERE status = 'failed' LIMIT 1),
     'ETL pipeline failed at transform_records step. Root cause: Source API returned paginated data with inconsistent schema. Records 15,000-20,000 had missing "created_at" field causing null pointer exception.',
     'error_analysis',
     '{"agent": "orchestrator", "error_type": "null_pointer", "records_affected": 5000}',
     ARRAY['etl', 'error', 'data-quality']),

    ('mem-004',
     (SELECT id FROM workflow_runs WHERE trigger_type = 'schedule' LIMIT 1),
     'Daily regression test suite passed with 94.2% success rate. 156/165 test cases passed. 7 flaky tests identified in payment module. 2 skipped due to external API timeout.',
     'summary',
     '{"agent": "validation", "pass_rate": 94.2, "flaky_tests": 7}',
     ARRAY['testing', 'regression', 'daily']),

    ('mem-005',
     NULL,
     'Market research completed for Q1 2024 AI agent market. Key findings: Market size estimated at $12.8B, growing at 43% CAGR. Top competitors: LangChain, CrewAI, AutoGen. Differentiator: enterprise-grade approval gates.',
     'research',
     '{"agent": "research", "topic": "market-analysis", "quarter": "Q1-2024"}',
     ARRAY['research', 'market', 'ai-agents']),

    ('mem-006',
     NULL,
     'Customer feedback analysis: 89% satisfaction rate. Top requested features: (1) Custom agent creation UI, (2) Webhook integrations, (3) Mobile dashboard, (4) SSO/SAML support.',
     'feedback',
     '{"agent": "research", "sample_size": 234, "satisfaction": 89}',
     ARRAY['feedback', 'customer', 'product']),

    ('mem-007',
     NULL,
     'Infrastructure cost analysis for March 2024: GCP spend $742 (down 12% from Feb). Breakdown: GKE $380, Cloud SQL $180, Memorystore $95, Cloud Run $47. Recommendation: Resize agent nodes for 30% savings.',
     'analysis',
     '{"agent": "orchestrator", "period": "2024-03", "total_cost": 742}',
     ARRAY['cost', 'infrastructure', 'optimization']),

    ('mem-008',
     NULL,
     'Workflow optimization: Customer Onboarding Pipeline average execution time reduced from 18m to 12m after parallelizing document validation and KYC check steps.',
     'optimization',
     '{"agent": "planner", "improvement_pct": 33}',
     ARRAY['optimization', 'performance', 'workflow']),

    ('mem-009',
     NULL,
     'Agent performance report - Week 15: Orchestrator avg latency 45ms, Security agent avg latency 120ms (up 15%), Vision agent avg latency 2.3s (stable), Research agent avg latency 8.7s (down 20%).',
     'report',
     '{"agent": "orchestrator", "period": "week-15"}',
     ARRAY['performance', 'agents', 'weekly-report']),

    ('mem-010',
     NULL,
     'Compliance update: New GDPR article 22 requirements affect automated decision-making workflows. All workflows with risk_score > 0.7 now require explicit human approval.',
     'compliance',
     '{"agent": "security", "regulation": "GDPR-Art22"}',
     ARRAY['compliance', 'gdpr', 'policy']);

-- ============================================
-- Audit Logs
-- ============================================
INSERT INTO audit_logs (user_id, action, resource_type, resource_id, payload, ip_address, created_at)
VALUES
    ((SELECT id FROM users WHERE email = 'admin@cloudlabos.ai'), 'login', 'user', NULL, '{"method": "password"}', '192.168.1.100', NOW() - interval '1 hour'),
    ((SELECT id FROM users WHERE email = 'admin@cloudlabos.ai'), 'workflow.execute', 'workflow', NULL, '{"workflow": "Customer Onboarding Pipeline"}', '192.168.1.100', NOW() - interval '50 minutes'),
    ((SELECT id FROM users WHERE email = 'sarah.chen@cloudlabos.ai'), 'approval.approve', 'approval', NULL, '{"step": "compare_results", "risk_score": 0.8}', '192.168.1.101', NOW() - interval '45 minutes'),
    ((SELECT id FROM users WHERE email = 'sarah.chen@cloudlabos.ai'), 'approval.reject', 'approval', NULL, '{"step": "capture_screenshots", "risk_score": 0.85}', '192.168.1.101', NOW() - interval '2 days'),
    ((SELECT id FROM users WHERE email = 'admin@cloudlabos.ai'), 'workflow.create', 'workflow', NULL, '{"workflow": "AI Content Generator"}', '192.168.1.100', NOW() - interval '3 days'),
    ((SELECT id FROM users WHERE email = 'marcus.johnson@cloudlabos.ai'), 'workflow.execute', 'workflow', NULL, '{"workflow": "Market Research Agent"}', '10.0.0.50', NOW() - interval '3 minutes');
