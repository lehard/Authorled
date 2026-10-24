# Spec Delta

## MODIFIED Requirements

### Requirement: Модели
`default_model()` MUST возвращать при каждом вызове новый экземпляр модели DeepSeek с псевдонимом прокси `deepseek-fast` без режима размышлений; `manager_model()` MUST возвращать модель с псевдонимом `deepseek-thinking` в режиме размышлений и MUST использоваться OS Manager и CompanyOS. Обе модели MUST обращаться к LiteLLM-прокси по `LITELLM_URL` с ключом `LITELLM_API_KEY`. Псевдонимы MUST объявляться только в `app/settings.py`; инженеры MUST брать их оттуда и MUST NOT задавать имена моделей сами.

#### Scenario: Модель менеджера
- GIVEN платформа запущена
- WHEN клиент выполняет `GET /teams`
- THEN `os-manager-internal` MUST иметь модель `deepseek-thinking`
