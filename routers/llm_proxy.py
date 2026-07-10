import json
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse

import db as db_service
import agent as agent_module
from schemas.llm_configs import ChatRequest, ChatResponse
from middleware import get_current_user_optional

router = APIRouter(prefix="/llm", tags=["LLM Proxy"])


@router.post("/chat", response_model=ChatResponse)
async def chat(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user_optional),
):
    pool = await db_service.get_pool()

    if body.llm_config_id:
        cfg = await pool.fetchrow("SELECT * FROM llm_configs WHERE id = $1 AND is_active = TRUE", body.llm_config_id)
        if not cfg:
            raise HTTPException(404, "LLM config not found or inactive")

    user_id = current_user["id"] if current_user else None
    try:
        content, metadata = await agent_module.chat_completion(
            messages=body.messages,
            pool=pool,
            llm_config_id=body.llm_config_id,
            max_tokens=body.max_tokens,
            temperature=body.temperature,
            user_id=user_id,
        )
    except Exception as exc:
        raise HTTPException(500, str(exc))

    await db_service.log_audit(pool, user_id, "llm.chat", "llm", details={"model": metadata.get("model")})
    return ChatResponse(
        id=metadata.get("id", ""),
        model=metadata.get("model", ""),
        content=content,
        finish_reason=metadata.get("finish_reason"),
        tokens_used=metadata.get("tokens_used"),
    )


@router.post("/chat/stream")
async def chat_stream(
    body: ChatRequest,
    current_user: dict = Depends(get_current_user_optional),
):
    body.stream = True
    pool = await db_service.get_pool()
    user_id = current_user["id"] if current_user else None

    async def event_stream():
        async for chunk in agent_module.chat_completion_stream(
            messages=body.messages,
            pool=pool,
            llm_config_id=body.llm_config_id,
            max_tokens=body.max_tokens,
            temperature=body.temperature,
            user_id=user_id,
        ):
            yield f"data: {json.dumps(chunk)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")
