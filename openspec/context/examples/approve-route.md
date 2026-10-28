---
owner: lehard
updated: 2026-10-24
---
# Пример: утверждение документа

Утверждает только автор, через свой маршрут API. LLM не участвует, всё
выполняется одной транзакцией в ядре.

## ✅ Хорошо

```python
# app/api/v1/documents.py
router = APIRouter(prefix="/api/v1/documents", tags=["documents"])

class ApproveRequest(BaseModel):
    version_id: UUID
    author_checks: list[str]          # субъективные пункты чек-листа, отмеченные автором

class ApproveResponse(BaseModel):
    document_id: UUID
    approved_version_id: UUID
    flagged_documents: list[UUID]     # зависимые документы, получившие «требует пересмотра»

@router.post("/{document_id}/approve", response_model=ApproveResponse)
async def approve(
    document_id: UUID,
    body: ApproveRequest,
    user: CurrentUser,
    idempotency_key: Annotated[str, Header(alias="Idempotency-Key")],
) -> ApproveResponse:
    doc = await core.documents.get_for_member(document_id, user.id)   # нет доступа → 404 (problem+json)
    result = await core.approval.approve(                              # одна транзакция в ядре:
        doc, body.version_id, body.author_checks,                      # проверка чек-листа, статус,
        approved_by=user.id, idempotency_key=idempotency_key,          # журнал, флаги зависимым
    )
    return ApproveResponse.model_validate(result)
```

Тесты: утверждение на реальном PostgreSQL; чужой проект → 404; повтор с тем же
`Idempotency-Key` не создаёт вторую версию; незакрытый формальный пункт → 422.

## ❌ Плохо

```python
@tool
def approve_document(doc_id: str) -> str:                 # инструмент утверждения у агента
    try:
        doc = db.query(Document).get(doc_id)              # нет проверки доступа к проекту
        doc.text = agent_state["draft"]                   # утверждённая версия правится на месте
        doc.status = "approved"
        logger.info(f"approved: {doc.text}")              # текст произведения в логах
        db.commit()                                       # зависимые документы не помечены
    except Exception:
        return "ok"                                       # молчаливый fallback
```

Что не так: утверждает агент, а не автор; нет проверки доступа; версия
изменена на месте; флаги пересмотра не поставлены; текст ушёл в логи;
ошибка проглочена.
