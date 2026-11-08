// Results of the co-author's changing calls as the chat reads them (openspec/specs/web/workspace,
// «Сделанное соавтором в чате»; design of coauthor-refusal-text, decision 4). The samples are the
// content Agno 3.1.10 sends over AG-UI: `to_json_str` (agno/os/interfaces/agui/utils.py) passes
// valid JSON through and wraps a plain string with `json.dumps`, escaping non-ASCII. Check them
// again when Agno is upgraded.
import {
  readOutcome,
  type Outcome,
} from "../src/screens/project/chat/outcome.ts";

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

if (problems.length > 0) {
  console.error("check-chat: results of the co-author's calls read wrong:");
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
console.log(
  `check-chat: ${SAMPLES.length} results of the co-author's calls — done, refusal as text, unreadable`,
);
