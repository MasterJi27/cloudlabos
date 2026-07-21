import json
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy import select
from app.config import settings

connect_args = {}
if settings.database_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_async_engine(settings.database_url, echo=settings.debug, connect_args=connect_args)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()


async def init_db():
    async with engine.begin() as conn:
        from app.models import __all__  # noqa: ensure models loaded
        await conn.run_sync(Base.metadata.create_all)


async def seed_data():
    async with async_session() as db:
        from app.core.auth import hash_password
        from app.core.roles import Role
        from app.models.user import User
        from app.models.workspace import Workspace, WorkspaceMember
        from app.models.agent import Agent, AgentTool, AgentStatus
        from app.models.workflow import Workflow, WorkflowRun, WorkflowRunStep, WorkflowStatus, StepStatus
        from app.models.memory import MemoryCollection, MemoryItem, MemoryType

        # Create default admin user
        result = await db.execute(select(User).where(User.email == "admin@cloudlabos.ai"))
        user = result.scalar_one_or_none()
        if not user:
            user = User(
                email="admin@cloudlabos.ai",
                name="Admin",
                password_hash=hash_password("admin123"),
                role=Role.ADMIN,
            )
            db.add(user)
            await db.commit()
            await db.refresh(user)

        # Create default workspace
        result = await db.execute(select(Workspace).where(Workspace.name == "My Workspace"))
        ws = result.scalar_one_or_none()
        if not ws:
            ws = Workspace(name="My Workspace", description="Main workspace for development and operations")
            db.add(ws)
            await db.commit()
            await db.refresh(ws)
            member = WorkspaceMember(workspace_id=ws.id, user_id=user.id, role="admin")
            db.add(member)
            await db.commit()

        # Seed agents
        result = await db.execute(select(Agent).where(Agent.workspace_id == ws.id))
        existing_agents = result.scalars().all()
        if not existing_agents:
            agents_data = [
                Agent(
                    name="Data Analyst", agent_type="analyst", model="gpt-4o",
                    status=AgentStatus.ACTIVE, system_prompt="You are a data analysis assistant.",
                    memory_usage="128 MB", uptime="14d 6h", tasks_total=1243, config={"temperature": 0.3},
                    workspace_id=ws.id, created_by=user.id,
                ),
                Agent(
                    name="Code Reviewer", agent_type="coding", model="gpt-4o",
                    status=AgentStatus.ACTIVE, system_prompt="You review code for bugs, security issues, and best practices.",
                    memory_usage="256 MB", uptime="7d 3h", tasks_total=3876, config={"temperature": 0.1},
                    workspace_id=ws.id, created_by=user.id,
                ),
                Agent(
                    name="Security Sentinel", agent_type="security", model="gpt-4o",
                    status=AgentStatus.IDLE, system_prompt="You monitor logs for security threats.",
                    memory_usage="512 MB", uptime="30d 12h", tasks_total=8921, config={"temperature": 0.2},
                    workspace_id=ws.id, created_by=user.id,
                ),
                Agent(
                    name="Research Bot", agent_type="research", model="gpt-4o",
                    status=AgentStatus.BUSY, system_prompt="You research and summarize information from multiple sources.",
                    memory_usage="64 MB", uptime="2d 8h", tasks_total=564, config={"temperature": 0.7},
                    workspace_id=ws.id, created_by=user.id,
                ),
                Agent(
                    name="Web Scraper", agent_type="automation", model="gpt-4o-mini",
                    status=AgentStatus.ACTIVE, system_prompt="You extract and structure data from web pages.",
                    memory_usage="192 MB", uptime="5d 22h", tasks_total=2341, config={"temperature": 0.0},
                    workspace_id=ws.id, created_by=user.id,
                ),
            ]
            for a in agents_data:
                db.add(a)
            await db.flush()

            tools_data = [
                AgentTool(agent_id=agents_data[0].id, name="chart_generator", description="Generate data visualizations", tool_type="builtin", source="internal"),
                AgentTool(agent_id=agents_data[0].id, name="sql_executor", description="Run SQL queries against databases", tool_type="builtin"),
                AgentTool(agent_id=agents_data[1].id, name="static_analyzer", description="Analyze source code for patterns", tool_type="builtin"),
                AgentTool(agent_id=agents_data[1].id, name="diff_viewer", description="View and compare code diffs", tool_type="builtin"),
                AgentTool(agent_id=agents_data[2].id, name="log_parser", description="Parse and analyze log files", tool_type="builtin"),
                AgentTool(agent_id=agents_data[4].id, name="html_parser", description="Parse HTML content", tool_type="builtin"),
            ]
            for t in tools_data:
                db.add(t)
            await db.commit()

        # Seed workflows
        result = await db.execute(select(Workflow).where(Workflow.workspace_id == ws.id))
        existing_workflows = result.scalars().all()
        if not existing_workflows:
            now = datetime.now(timezone.utc)
            workflows_data = [
                Workflow(
                    name="Daily Security Scan", description="Scans infrastructure for vulnerabilities and generates report.",
                    status=WorkflowStatus.ACTIVE, version="2.1.0", steps=4,
                    definition={
                        "steps": [
                            {"name": "Scan Endpoints", "type": "agent", "config": {"agent_type": "security"}},
                            {"name": "Analyze Logs", "type": "agent", "config": {"agent_type": "security"}},
                            {"name": "Generate Report", "type": "function", "config": {"function": "generate_pdf"}},
                            {"name": "Notify Team", "type": "function", "config": {"channel": "slack"}},
                        ]
                    },
                    workspace_id=ws.id, created_by=user.id,
                ),
                Workflow(
                    name="Data Pipeline ETL", description="Extracts, transforms, and loads data from multiple sources.",
                    status=WorkflowStatus.ACTIVE, version="1.3.0", steps=3,
                    definition={
                        "steps": [
                            {"name": "Extract Sources", "type": "function", "config": {"source": "postgres"}},
                            {"name": "Transform Data", "type": "agent", "config": {"agent_type": "analyst"}},
                            {"name": "Load Warehouse", "type": "function", "config": {"destination": "s3"}},
                        ]
                    },
                    workspace_id=ws.id, created_by=user.id,
                ),
                Workflow(
                    name="Weekly Summary Report", description="Aggregates weekly metrics and sends summary email.",
                    status=WorkflowStatus.DRAFT, version="0.9.0", steps=2,
                    definition={
                        "steps": [
                            {"name": "Collect Metrics", "type": "function", "config": {"source": "prometheus"}},
                            {"name": "Generate Summary", "type": "agent", "config": {"agent_type": "analyst"}},
                        ]
                    },
                    workspace_id=ws.id, created_by=user.id,
                ),
            ]
            for w in workflows_data:
                db.add(w)
            await db.flush()

            # Seed runs with steps
            runs_data = [
                WorkflowRun(
                    workflow_id=workflows_data[0].id, workflow_name=workflows_data[0].name,
                    status="success", trigger="scheduled", progress=100,
                    definition=workflows_data[0].definition,
                    result={"summary": "Scan completed. 0 critical, 2 medium vulnerabilities found."},
                    started_at=now, completed_at=now, created_by=user.id,
                ),
                WorkflowRun(
                    workflow_id=workflows_data[1].id, workflow_name=workflows_data[1].name,
                    status="success", trigger="manual", progress=100,
                    definition=workflows_data[1].definition,
                    result={"rows_processed": 45231, "duration_seconds": 127},
                    started_at=now, completed_at=now, created_by=user.id,
                ),
                WorkflowRun(
                    workflow_id=workflows_data[0].id, workflow_name=workflows_data[0].name,
                    status="failed", trigger="scheduled", progress=60,
                    definition=workflows_data[0].definition,
                    error="Step 'Analyze Logs' timed out after 300s",
                    started_at=now, completed_at=now, created_by=user.id,
                ),
                WorkflowRun(
                    workflow_id=workflows_data[1].id, workflow_name=workflows_data[1].name,
                    status="success", trigger="scheduled", progress=100,
                    definition=workflows_data[1].definition,
                    result={"rows_processed": 38912, "duration_seconds": 94},
                    started_at=now, completed_at=now, created_by=user.id,
                ),
                WorkflowRun(
                    workflow_id=workflows_data[0].id, workflow_name=workflows_data[0].name,
                    status="running", trigger="manual", progress=45,
                    definition=workflows_data[0].definition,
                    started_at=now, created_by=user.id,
                ),
            ]
            for r in runs_data:
                db.add(r)
            await db.flush()

            for run, steps in [
                (runs_data[0], [
                    WorkflowRunStep(run_id=runs_data[0].id, name="Scan Endpoints", status=StepStatus.SUCCESS, input={"target": "internal"}, output={"vulnerabilities": []}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[0].id, name="Analyze Logs", status=StepStatus.SUCCESS, input={}, output={"findings": 2}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[0].id, name="Generate Report", status=StepStatus.SUCCESS, input={}, output={"path": "/reports/scan-2024.pdf"}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[0].id, name="Notify Team", status=StepStatus.SUCCESS, input={}, output={"sent": True}, started_at=now, completed_at=now),
                ]),
                (runs_data[1], [
                    WorkflowRunStep(run_id=runs_data[1].id, name="Extract Sources", status=StepStatus.SUCCESS, input={"source": "postgres"}, output={"rows": 45231}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[1].id, name="Transform Data", status=StepStatus.SUCCESS, input={}, output={"transformed": True}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[1].id, name="Load Warehouse", status=StepStatus.SUCCESS, input={}, output={"loaded": 45231}, started_at=now, completed_at=now),
                ]),
                (runs_data[2], [
                    WorkflowRunStep(run_id=runs_data[2].id, name="Scan Endpoints", status=StepStatus.SUCCESS, input={}, output={"vulnerabilities": []}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[2].id, name="Analyze Logs", status=StepStatus.FAILED, input={}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[2].id, name="Generate Report", status=StepStatus.SKIPPED, input={}, output={}),
                    WorkflowRunStep(run_id=runs_data[2].id, name="Notify Team", status=StepStatus.SKIPPED, input={}, output={}),
                ]),
                (runs_data[3], [
                    WorkflowRunStep(run_id=runs_data[3].id, name="Extract Sources", status=StepStatus.SUCCESS, input={}, output={"rows": 38912}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[3].id, name="Transform Data", status=StepStatus.SUCCESS, input={}, output={"transformed": True}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[3].id, name="Load Warehouse", status=StepStatus.SUCCESS, input={}, output={"loaded": 38912}, started_at=now, completed_at=now),
                ]),
                (runs_data[4], [
                    WorkflowRunStep(run_id=runs_data[4].id, name="Scan Endpoints", status=StepStatus.SUCCESS, input={}, output={}, started_at=now, completed_at=now),
                    WorkflowRunStep(run_id=runs_data[4].id, name="Analyze Logs", status=StepStatus.RUNNING, input={}, started_at=now),
                ]),
            ]:
                for s in steps:
                    db.add(s)
            await db.commit()

        # Seed memory collections
        result = await db.execute(select(MemoryCollection).where(MemoryCollection.workspace_id == ws.id))
        existing_memories = result.scalars().all()
        if not existing_memories:
            now = datetime.now(timezone.utc)
            collections_data = [
                MemoryCollection(
                    name="System Knowledge Base", description="Important system configurations and documentation.",
                    content_type=MemoryType.KNOWLEDGE, workspace_id=ws.id, created_by=user.id,
                ),
                MemoryCollection(
                    name="Chat History", description="Agent conversation logs and interactions.",
                    content_type=MemoryType.CHAT, workspace_id=ws.id, created_by=user.id,
                ),
                MemoryCollection(
                    name="Code Repository", description="Code snippets, patterns, and references.",
                    content_type=MemoryType.CODE, workspace_id=ws.id, created_by=user.id,
                ),
            ]
            for c in collections_data:
                db.add(c)
            await db.flush()

            items_data = [
                MemoryItem(collection_id=collections_data[0].id, content="Database connection string uses SSL with certificate rotation every 90 days.", token_count=18, source="admin", created_by=user.id),
                MemoryItem(collection_id=collections_data[0].id, content="API Gateway rate limit: 1000 requests/min per user.", token_count=12, source="system", created_by=user.id),
                MemoryItem(collection_id=collections_data[0].id, content="Deployment pipeline uses Blue/Green strategy with automatic rollback on health check failure.", token_count=22, source="devops", created_by=user.id),
                MemoryItem(collection_id=collections_data[1].id, content="User: Can you optimize the query? Agent: I'd recommend adding an index on the created_at column and using a covering index.", token_count=25, source="chat", created_by=user.id),
                MemoryItem(collection_id=collections_data[1].id, content="User: What's the error rate? Agent: Currently at 0.02%, well below the SLO of 0.1%.", token_count=20, source="chat", created_by=user.id),
                MemoryItem(collection_id=collections_data[2].id, content="def rate_limit_middleware(max_requests=100, window_seconds=60):\n    cache = {}\n    def middleware(request):\n        ip = request.client.host\n        now = time.time()\n        if ip in cache:\n            requests, window_start = cache[ip]\n            if now - window_start < window_seconds:\n                if requests >= max_requests:\n                    return Response(status_code=429)\n                cache[ip] = (requests + 1, window_start)\n            else:\n                cache[ip] = (1, now)\n        else:\n            cache[ip] = (1, now)", token_count=80, source="codebase", created_by=user.id),
                MemoryItem(collection_id=collections_data[2].id, content="async def retry_with_backoff(func, max_retries=3, base_delay=1.0):\n    for attempt in range(max_retries):\n        try:\n            return await func()\n        except Exception as e:\n            if attempt == max_retries - 1:\n                raise\n            await asyncio.sleep(base_delay * (2 ** attempt))", token_count=55, source="codebase", created_by=user.id),
            ]
            for item in items_data:
                db.add(item)
            await db.commit()
