"""Prebuilt workflow templates users can instantiate with one click."""

WORKFLOW_TEMPLATES = [
    {
        "id": "daily-security-scan",
        "name": "Daily Security Scan",
        "description": "Scan endpoints, analyze logs, and summarize findings.",
        "category": "Security",
        "definition": {"steps": [
            {"name": "Scan Endpoints", "type": "agent", "config": {"agent_type": "security", "prompt": "Scan the configured endpoints and list any exposed services or misconfigurations."}},
            {"name": "Analyze Logs", "type": "agent", "config": {"agent_type": "security", "prompt": "Review recent logs for anomalies and potential intrusion signals."}},
            {"name": "Summarize Findings", "type": "agent", "config": {"agent_type": "analyst", "prompt": "Summarize the scan and log analysis into an executive risk summary."}},
        ]},
    },
    {
        "id": "content-research-brief",
        "name": "Content Research Brief",
        "description": "Research a topic and produce a structured brief.",
        "category": "Research",
        "definition": {"steps": [
            {"name": "Gather Sources", "type": "agent", "config": {"agent_type": "research", "prompt": "Gather the key facts and sources on the given topic."}},
            {"name": "Synthesize Brief", "type": "agent", "config": {"agent_type": "analyst", "prompt": "Turn the gathered research into a structured brief with headings and takeaways."}},
        ]},
    },
    {
        "id": "code-review-pipeline",
        "name": "Code Review Pipeline",
        "description": "Review a diff for bugs, security, and style, then summarize.",
        "category": "Engineering",
        "definition": {"steps": [
            {"name": "Review Code", "type": "agent", "config": {"agent_type": "coding", "prompt": "Review the provided code for correctness, security, and readability."}},
            {"name": "Risk Assessment", "type": "agent", "config": {"agent_type": "security", "prompt": "Assess the security risk of the reviewed changes."}},
            {"name": "Summarize", "type": "agent", "config": {"agent_type": "analyst", "prompt": "Produce a concise review summary with prioritized action items."}},
        ]},
    },
    {
        "id": "data-pipeline-etl",
        "name": "Data Pipeline (ETL)",
        "description": "Extract, transform, and load data across sources.",
        "category": "Data",
        "definition": {"steps": [
            {"name": "Extract", "type": "function", "config": {"source": "database"}},
            {"name": "Transform", "type": "agent", "config": {"agent_type": "analyst", "prompt": "Clean and normalize the extracted records."}},
            {"name": "Load", "type": "function", "config": {"destination": "warehouse"}},
        ]},
    },
    {
        "id": "weekly-summary-report",
        "name": "Weekly Summary Report",
        "description": "Aggregate weekly metrics and draft a summary.",
        "category": "Reporting",
        "definition": {"steps": [
            {"name": "Collect Metrics", "type": "function", "config": {"source": "metrics"}},
            {"name": "Draft Summary", "type": "agent", "config": {"agent_type": "analyst", "prompt": "Write a weekly summary highlighting notable changes in the metrics."}},
        ]},
    },
    {
        "id": "support-triage",
        "name": "Support Ticket Triage",
        "description": "Classify an incoming ticket and draft a first response.",
        "category": "Support",
        "definition": {"steps": [
            {"name": "Classify Ticket", "type": "agent", "config": {"agent_type": "general", "prompt": "Classify this support ticket by urgency and category."}},
            {"name": "Draft Response", "type": "agent", "config": {"agent_type": "general", "prompt": "Draft a helpful first response to the customer."}},
        ]},
    },
]


def get_template(template_id: str):
    return next((t for t in WORKFLOW_TEMPLATES if t["id"] == template_id), None)
