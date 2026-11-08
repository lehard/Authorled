// Results of the co-author's changing calls as the chat reads them (openspec/specs/web/workspace,
// «Сделанное соавтором в чате»; design of coauthor-refusal-text, decision 4). The samples are the
// content Agno 3.1.10 sends over AG-UI: `to_json_str` (agno/os/interfaces/agui/utils.py) passes
// valid JSON through and wraps a plain string with `json.dumps`, escaping non-ASCII. Check them
// again when Agno is upgraded.
import {
  readOutcome,
  type Outcome,
} from "../src/screens/project/chat/outcome.ts";
import {
  NO_CONNECTION,
  readRunError,
  UNAVAILABLE,
  type RunError,
} from "../src/screens/project/chat/runError.ts";

const REFUSAL =
  "Отказ: Поле «role» должно быть одним из: main, secondary, episodic.";

const SAMPLES: [name: string, content: string, expected: Outcome][] = [
  [
    "done",
    '{"done": "Создан персонаж «Пётр»", "target": {"type": "document", "id": "d1", "kind": "character"}}',
    {
      kind: "done",
      done: "Создан персонаж «Пётр»",
      target: { type: "document", id: "d1", kind: "character" },
    },
  ],
  [
    // Exactly what the server sent on 2026-11-08 (Python json.dumps of the refusal).
    "refusal",
    '"\\u041e\\u0442\\u043a\\u0430\\u0437: \\u041f\\u043e\\u043b\\u0435 \\u00abrole\\u00bb \\u0434\\u043e\\u043b\\u0436\\u043d\\u043e \\u0431\\u044b\\u0442\\u044c \\u043e\\u0434\\u043d\\u0438\\u043c \\u0438\\u0437: main, secondary, episodic."',
    { kind: "refused", text: REFUSAL },
  ],
  ["number", "42", { kind: "unreadable" }],
  ["array", "[]", { kind: "unreadable" }],
  ["null", "null", { kind: "unreadable" }],
  ["answer of the author", '{"accepted": true}', { kind: "unreadable" }],
  [
    "done without target",
    '{"done": "Создана заметка"}',
    { kind: "unreadable" },
  ],
  ["not JSON", "не JSON", { kind: "unreadable" }],
];

const problems: string[] = [];
for (const [name, content, expected] of SAMPLES) {
  const got = readOutcome(content);
  if (JSON.stringify(got) !== JSON.stringify(expected))
    problems.push(
      `${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`,
    );
}

// Failed runs as the chat reads them (openspec/specs/web/workspace, «Чат с соавтором»; design of
// coauthor-chat-errors, decision 4). The samples follow `on_run_error` of Agno 3.1.10
// (agno/os/interfaces/agui/handlers.py): `message` is the exception's text, `rawEvent` is Agno's
// RunErrorEvent; the AG-UI router sends a failure outside the run without `rawEvent`. Check them
// again when Agno is upgraded.
const LIMIT = "Лимит соавтора на этот период исчерпан. Он обновится 7 декабря.";
const CHECK_FAILED =
  "Не удалось проверить лимит соавтора. Напишите в поддержку.";
// What the chat got on 2026-11-08 with no money on the DeepSeek account.
const NO_BALANCE =
  'litellm.BadRequestError: DeepseekException - {"error":{"message":"Insufficient Balance ' +
  '(request_id: 1dcb7d60-ad5c-4189-b7b6-0f82eedc12f9)","type":"insufficient_balance_error",' +
  '"param":null,"code":"invalid_request_error"}} LiteLLM: model group \'deepseek-fast\' failed ' +
  "with the error above. No fallback was attempted.";

function agnoEvent(content: string, additional_data?: unknown) {
  return {
    event: "RunError",
    agent_id: "coauthor",
    run_id: "r1",
    session_id: "s1",
    content,
    error_type:
      additional_data === undefined ? "BadRequestError" : "InputCheckError",
    additional_data,
  };
}

const RUN_ERRORS: [
  name: string,
  message: string,
  rawEvent: unknown,
  expected: RunError,
][] = [
  ["model failure", NO_BALANCE, agnoEvent(NO_BALANCE), { kind: "failure" }],
  ["failure outside the run", "boom", undefined, { kind: "failure" }],
  [
    "limit",
    LIMIT,
    agnoEvent(LIMIT, {
      reason: "usage_limit_reached",
      renews_at: "2026-12-07T00:00:00+00:00",
    }),
    { kind: "refusal", text: LIMIT, tone: "notice" },
  ],
  [
    "subscription ended",
    "Подписка закончилась. Соавтор снова заработает после продления.",
    agnoEvent("", { reason: "subscription_ended", subscription_id: "x" }),
    {
      kind: "refusal",
      text: "Подписка закончилась. Соавтор снова заработает после продления.",
      tone: "error",
    },
  ],
  [
    "check failed",
    CHECK_FAILED,
    agnoEvent(CHECK_FAILED, { reason: "usage_check_failed" }),
    { kind: "refusal", text: CHECK_FAILED, tone: "error" },
  ],
  [
    "record failed",
    "Не удалось записать расход соавтора. Напишите в поддержку.",
    agnoEvent("", { reason: "usage_record_failed" }),
    {
      kind: "refusal",
      text: "Не удалось записать расход соавтора. Напишите в поддержку.",
      tone: "error",
    },
  ],
  [
    "unknown reason",
    NO_BALANCE,
    agnoEvent(NO_BALANCE, { reason: "something_new" }),
    { kind: "failure" },
  ],
  [
    "reason of Object.prototype",
    "x",
    agnoEvent("x", { reason: "toString" }),
    { kind: "failure" },
  ],
  [
    "data not an object",
    "x",
    agnoEvent("x", "usage_limit_reached"),
    { kind: "failure" },
  ],
  [
    "reason not a string",
    "x",
    agnoEvent("x", { reason: 1 }),
    { kind: "failure" },
  ],
];

for (const [name, message, rawEvent, expected] of RUN_ERRORS) {
  const got = readRunError(message, rawEvent);
  if (JSON.stringify(got) !== JSON.stringify(expected))
    problems.push(
      `run error, ${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(got)}`,
    );
}
for (const [name, text] of [
  ["UNAVAILABLE", UNAVAILABLE],
  ["NO_CONNECTION", NO_CONNECTION],
]) {
  if (/litellm|deepseek|agno/i.test(text))
    problems.push(`${name} names a part of the server: ${text}`);
}

if (problems.length > 0) {
  console.error("check-chat: the chat reads results or failed runs wrong:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `check-chat: ${SAMPLES.length} results of the co-author's calls — done, refusal as text, unreadable; ` +
    `${RUN_ERRORS.length} failed runs — refusals of the product as they are, the rest without details`,
);
