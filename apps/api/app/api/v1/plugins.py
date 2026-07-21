from fastapi import APIRouter

router = APIRouter()

PLUGINS = [
    { "id": "slack", "name": "Slack", "description": "Send notifications and alerts to Slack channels", "category": "communication", "installed": True, "version": "2.1.0", "icon": "MessageSquare" },
    { "id": "datadog", "name": "Datadog", "description": "Export workflow metrics and execution data to Datadog", "category": "monitoring", "installed": True, "version": "1.4.2", "icon": "BarChart3" },
    { "id": "pagerduty", "name": "PagerDuty", "description": "Trigger PagerDuty incidents on workflow failures", "category": "alerting", "installed": False, "version": "1.0.0", "icon": "AlertTriangle" },
    { "id": "jira", "name": "Jira", "description": "Create and update Jira tickets from workflow events", "category": "project-management", "installed": False, "version": "0.9.0", "icon": "ClipboardList" },
    { "id": "github", "name": "GitHub", "description": "Trigger GitHub Actions and update commit statuses", "category": "devops", "installed": True, "version": "3.0.1", "icon": "GitBranch" },
    { "id": "s3", "name": "S3 Storage", "description": "Store and retrieve artifacts from S3-compatible storage", "category": "storage", "installed": False, "version": "1.2.0", "icon": "HardDrive" },
    { "id": "postgres", "name": "PostgreSQL", "description": "Execute queries and store results in PostgreSQL databases", "category": "data", "installed": False, "version": "2.0.0", "icon": "Database" },
    { "id": "openai", "name": "OpenAI", "description": "Call GPT models for text generation and analysis", "category": "ai", "installed": True, "version": "4.1.0", "icon": "Brain" },
    { "id": "sentry", "name": "Sentry", "description": "Capture and report errors from agent executions", "category": "monitoring", "installed": False, "version": "1.1.0", "icon": "Bug" },
    { "id": "email", "name": "SMTP Email", "description": "Send email notifications via SMTP", "category": "communication", "installed": True, "version": "1.5.0", "icon": "Mail" },
]


@router.get("/")
async def list_plugins():
    return PLUGINS
