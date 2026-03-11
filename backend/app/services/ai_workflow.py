import json
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are an expert project planner. Given a user's goal, generate a structured workflow.

Respond with a valid JSON object only, no markdown or extra text. Format:
{
  "title": "Short workflow title (e.g. 'Build portfolio website')",
  "phases": [
    {
      "title": "Phase name (e.g. Planning)",
      "order": 1,
      "tasks": [
        { "title": "Task title", "description": "Brief description" },
        ...
      ]
    },
    ...
  ]
}

Include 3-6 phases. Each phase should have 2-5 concrete tasks. Use clear, actionable task titles. Order phases logically (planning first, then execution, then testing/deployment)."""


async def generate_workflow_from_goal(goal: str) -> dict:
    if not settings.openai_api_key:
        return _fallback_workflow(goal)

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openai_model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": goal},
                    ],
                    "temperature": 0.5,
                },
            )
            response.raise_for_status()
            data = response.json()
            content = data["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            return json.loads(content)
    except httpx.HTTPStatusError as e:
        logger.warning("OpenAI API error %s, using fallback workflow: %s", e.response.status_code, e)
        return _fallback_workflow(goal)
    except (json.JSONDecodeError, KeyError, IndexError) as e:
        logger.warning("OpenAI response parse error, using fallback workflow: %s", e)
        return _fallback_workflow(goal)
    except Exception as e:
        logger.warning("OpenAI request failed, using fallback workflow: %s", e)
        return _fallback_workflow(goal)


def _fallback_workflow(goal: str) -> dict:
    return {
        "title": goal[:80] + ("..." if len(goal) > 80 else ""),
        "phases": [
            {"title": "Planning", "order": 1, "tasks": [{"title": "Define scope", "description": "Outline what you want to achieve"}, {"title": "Break down milestones", "description": "Split into smaller milestones"}]},
            {"title": "Execution", "order": 2, "tasks": [{"title": "Execute first milestone", "description": "Start working on the first part"}, {"title": "Review and iterate", "description": "Check progress and adjust"}]},
            {"title": "Completion", "order": 3, "tasks": [{"title": "Final review", "description": "Review all deliverables"}, {"title": "Wrap up", "description": "Document and close out"}]},
        ],
    }


async def ai_assistant_add_tasks(
    workflow_goal: str, current_phases_summary: str, prompt: str
) -> dict:
    if not settings.openai_api_key:
        return {"phases": []}

    user_message = f"""Existing workflow goal: {workflow_goal}

Current phases (summary): {current_phases_summary}

User request: {prompt}

Respond with a valid JSON object only. Format:
{{
  "phases": [
    {{
      "title": "Phase name",
      "order": number,
      "tasks": [
        {{ "title": "Task title", "description": "Brief description" }}
      ]
    }}
  ]
}}
Only include NEW phases or new tasks to add. Use order values that fit into the existing workflow. If the user asks to add testing steps, add a phase or tasks for testing."""

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://api.openai.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.openai_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openai_model,
                    "messages": [
                        {"role": "system", "content": "You are a workflow assistant. Reply with JSON only."},
                        {"role": "user", "content": user_message},
                    ],
                    "temperature": 0.5,
                },
            )
            response.raise_for_status()
            content = response.json()["choices"][0]["message"]["content"].strip()
            if content.startswith("```"):
                content = content.split("```")[1]
                if content.startswith("json"):
                    content = content[4:]
            return json.loads(content)
    except Exception as e:
        logger.warning("AI assistant request failed: %s", e)
        return {"phases": []}
