import json

import httpx

from app.config import settings
from app.log_config import get_logger

logger = get_logger(__name__)

SYSTEM_PROMPT = """You are an expert project planner. You generate ONE workflow per goal. Each goal must get a UNIQUE workflow—different phase names, different task names, different structure. Never output the same generic workflow twice.

Critical rules:
- BAN these generic phase names for most goals: "Planning", "Execution", "Completion", "Implementation". Use domain-specific phases instead (e.g. "Research & Scope" for a report, "Design & Prototype" for a product, "Learn Basics" for learning goals, "Prepare" and "Launch" for events).
- Phase names and every task must be SPECIFIC to the goal's domain. Examples: goal "Learn guitar" → phases like "Basics & Chords", "Songs & Rhythm", "Technique"; goal "Launch SaaS" → "Discovery", "MVP Build", "Beta", "Launch"; goal "Plan wedding" → "Venue & Date", "Vendors", "Invites & RSVPs", "Day-of".
- Use 3–6 phases and 2–5 tasks per phase; vary the count by goal complexity.
- Output valid JSON only. No markdown, no code fence, no explanation. Format: {"title": "...", "phases": [{"title": "...", "order": 1, "tasks": [{"title": "...", "description": "..."}]}]}"""


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
                        {
                            "role": "user",
                            "content": f"Create a UNIQUE workflow only for this goal. Use domain-specific phase and task names—no generic template.\n\nGoal: {goal}",
                        },
                    ],
                    "temperature": 0.9,
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
    """When OpenAI is unavailable, return a goal-derived workflow so different goals look different."""
    # Use goal hash to pick one of several structures so fallback isn't identical every time
    h = hash(goal.strip().lower()) % 3
    title = goal[:80] + ("..." if len(goal) > 80 else "")
    if h == 0:
        phases = [
            {"title": "Scope & prep", "order": 1, "tasks": [{"title": "Clarify scope", "description": "Define what success looks like"}, {"title": "List milestones", "description": "Break the goal into steps"}]},
            {"title": "Do the work", "order": 2, "tasks": [{"title": "Tackle first milestone", "description": "Get started"}, {"title": "Check progress", "description": "Adjust as needed"}]},
            {"title": "Finish", "order": 3, "tasks": [{"title": "Review", "description": "Review outcomes"}, {"title": "Close out", "description": "Document and wrap up"}]},
        ]
    elif h == 1:
        phases = [
            {"title": "Research", "order": 1, "tasks": [{"title": "Gather info", "description": "Research what you need"}, {"title": "Define approach", "description": "Choose your approach"}]},
            {"title": "Build", "order": 2, "tasks": [{"title": "Create", "description": "Produce the main deliverable"}, {"title": "Iterate", "description": "Refine based on feedback"}]},
            {"title": "Validate", "order": 3, "tasks": [{"title": "Test or validate", "description": "Check it works"}, {"title": "Ship or publish", "description": "Finalize and release"}]},
        ]
    else:
        phases = [
            {"title": "Setup", "order": 1, "tasks": [{"title": "Get ready", "description": "Prepare tools and resources"}, {"title": "Plan steps", "description": "Outline your steps"}]},
            {"title": "Execute", "order": 2, "tasks": [{"title": "Work through steps", "description": "Do the main work"}, {"title": "Review", "description": "Check quality"}]},
            {"title": "Launch", "order": 3, "tasks": [{"title": "Finalize", "description": "Complete remaining items"}, {"title": "Done", "description": "Mark complete and document"}]},
        ]
    return {"title": title, "phases": phases}


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
