"""Tests that the workflow engine preserves the run created by the API gateway."""

import asyncio
import importlib.util
from pathlib import Path
from unittest.mock import AsyncMock

import pytest

module_path = Path(__file__).resolve().parents[1] / "main.py"
module_spec = importlib.util.spec_from_file_location("workflow_engine_main", module_path)
workflow_engine = importlib.util.module_from_spec(module_spec)
assert module_spec and module_spec.loader
module_spec.loader.exec_module(workflow_engine)
WorkflowRunner = workflow_engine.WorkflowRunner


@pytest.mark.asyncio
async def test_start_run_reuses_gateway_run_id():
    database = AsyncMock()
    database.fetchrow.return_value = {"definition": {"steps": []}}
    database.execute.return_value = "UPDATE 1"
    redis = AsyncMock()
    runner = WorkflowRunner(database, redis)
    runner._execute_dag = AsyncMock()

    run_id = await runner.start_run(
        workflow_id="workflow-id",
        workspace_id="workspace-id",
        input_payload={"target": "https://example.com"},
        approval_mode="policy",
        run_id="gateway-run-id",
    )
    await asyncio.sleep(0)

    assert run_id == "gateway-run-id"
    assert not any("INSERT INTO workflow_runs" in call.args[0] for call in database.execute.await_args_list)
    redis.hset.assert_awaited_once()
