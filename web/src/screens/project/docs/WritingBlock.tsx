import { useUpdate } from "@refinedev/core";
import { useId, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Project } from "@/data/model";
import {
  browserZone,
  useDailyGoal,
  useWriting,
  type StoryGoal,
  type Writing,
  type WritingDay,
} from "@/data/writing";

import { FieldCard } from "./DocHead";

// Block «Письмо» of the document «История» (openspec/specs/web/workspace, «Блок «Письмо»» and
// the requirements after it): today against the daily goal, 30 days, the goal of the story and
// the form of the goals. Every number comes from the core; this file only shows them.

const number = new Intl.NumberFormat("ru-RU");
const fmt = (n: number) => number.format(n);
const dayName = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});
/** «4 ноября» of a `YYYY-MM-DD` date. */
const fmtDay = (date: string) => dayName.format(new Date(`${date}T00:00:00Z`));

function plural(n: number, forms: [string, string, string]): string {
  const tens = Math.abs(n) % 100;
  const ones = tens % 10;
  if (tens > 10 && tens < 20) return forms[2];
  if (ones === 1) return forms[0];
  if (ones >= 2 && ones <= 4) return forms[1];
  return forms[2];
}
const words = (n: number) =>
  `${fmt(n)} ${plural(n, ["слово", "слова", "слов"])}`;

export function WritingBlock({
  draftId,
  project,
}: {
  draftId: string;
  project: Project;
}) {
  const [zone] = useState(browserZone);
  const { writing, error, loading, reload } = useWriting(draftId, zone);
  const [editing, setEditing] = useState(false);

  let body: ReactNode;
  if (zone === null)
    body = (
      <p className="text-destructive">
        Не удалось определить часовой пояс браузера.
      </p>
    );
  else if (error)
    body = (
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-destructive">{error.message}</p>
        <Button variant="outline" size="sm" onClick={() => void reload()}>
          Повторить
        </Button>
      </div>
    );
  else if (loading || writing === undefined)
    body = <p className="text-muted-foreground">Загрузка…</p>;
  else if (editing)
    body = (
      <GoalForm
        writing={writing}
        project={project}
        onDone={() => {
          setEditing(false);
          void reload();
        }}
        onCancel={() => setEditing(false)}
      />
    );
  else
    body = (
      <div className="grid gap-6">
        <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)] sm:items-center">
          <Today writing={writing} />
          <StoryProgress story={writing.story} />
        </div>
        <Days writing={writing} />
      </div>
    );

  return (
    <FieldCard>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-heading-2">Письмо</h2>
        {writing !== undefined && (
          <p className="text-caption text-muted-foreground">
            {writing.dailyGoal === null
              ? "дневная цель не задана"
              : `цель на день — ${words(writing.dailyGoal)} · по всем историям`}
          </p>
        )}
        {writing !== undefined && !editing && (
          <Button
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setEditing(true)}
          >
            Настроить цель
          </Button>
        )}
      </div>
      {body}
    </FieldCard>
  );
}

const RING = 44;
const CIRCLE = 2 * Math.PI * RING;

function Today({ writing }: { writing: Writing }) {
  const today = writing.days[writing.days.length - 1];
  const goal = writing.dailyGoal;
  const share =
    today.words === null || goal === null
      ? 0
      : Math.min(1, Math.max(0, today.words / goal));
  let caption: string;
  if (today.words === null) caption = "сегодня";
  else if (goal === null) caption = "слов сегодня";
  else if (today.words >= goal) caption = "сегодня · цель выполнена";
  else caption = `сегодня · ещё ${fmt(goal - today.words)}`;
  return (
    <div className="grid justify-items-center gap-2">
      <div className="relative size-28">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={RING}
            fill="none"
            strokeWidth="7"
            className="stroke-muted"
          />
          {share > 0 && (
            <circle
              cx="50"
              cy="50"
              r={RING}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              strokeDasharray={`${share * CIRCLE} ${CIRCLE}`}
              className="stroke-status-in-progress"
            />
          )}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center">
          {today.words === null ? (
            <span className="px-3 text-caption text-muted-foreground">
              Сегодня ещё не писали
            </span>
          ) : (
            <>
              <span className="text-heading-2 tabular-nums">
                {fmt(today.words)}
              </span>
              {goal !== null && (
                <span className="text-caption text-muted-foreground">
                  из {fmt(goal)}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      <p className="text-caption text-muted-foreground">{caption}</p>
    </div>
  );
}

function barColor(day: WritingDay, today: string): string {
  if (day.date === today) return "bg-status-in-progress";
  if (day.met === true) return "bg-status-approved";
  return "bg-border-strong";
}

function Days({ writing }: { writing: Writing }) {
  const goal = writing.dailyGoal;
  const top = Math.max(goal ?? 0, ...writing.days.map((d) => d.words ?? 0), 1);
  const first = writing.days[0];
  return (
    <div className="grid min-w-0 gap-2">
      {goal !== null && (
        <p className="text-right text-caption text-muted-foreground">
          - - цель {fmt(goal)}
        </p>
      )}
      <TooltipProvider delayDuration={150}>
        <div className="relative h-32" role="list" aria-label="Слова по дням">
          {goal !== null && (
            <div
              aria-hidden
              className="absolute inset-x-0 border-t border-dashed border-muted-foreground"
              style={{ bottom: `${(goal / top) * 100}%` }}
            />
          )}
          <div className="absolute inset-0 flex items-end gap-[3px]">
            {writing.days.map((day) => {
              const label =
                day.words === null
                  ? `${fmtDay(day.date)}: нет записей`
                  : `${fmtDay(day.date)}: ${words(day.words)}`;
              return (
                <Tooltip key={day.date}>
                  <TooltipTrigger asChild>
                    <div
                      role="listitem"
                      aria-label={label}
                      className="flex h-full min-w-0 flex-1 items-end"
                    >
                      {day.words !== null && (
                        <div
                          className={`w-full rounded-t-sm ${barColor(day, writing.today)} ${day.words <= 0 ? "h-0.5" : ""}`}
                          style={
                            day.words > 0
                              ? { height: `${(day.words / top) * 100}%` }
                              : undefined
                          }
                        />
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>{label}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </TooltipProvider>
      <div className="flex justify-between text-caption text-muted-foreground">
        <span>{fmtDay(first.date)}</span>
        <span>сегодня</span>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <Swatch className="bg-status-approved">цель есть</Swatch>
        <Swatch className="bg-border-strong">меньше цели</Swatch>
        <Swatch className="bg-status-in-progress">сегодня</Swatch>
      </div>
    </div>
  );
}

function Swatch({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-sm ${className}`} />
      {children}
    </span>
  );
}

function StoryProgress({ story }: { story: StoryGoal }) {
  if (story.goal === null)
    return <p className="text-muted-foreground">Цель истории не задана</p>;
  const left = Math.max(0, story.goal - story.words);
  let pace: string | null = null;
  if (story.perDay === 0) pace = "Цель достигнута";
  else if (story.deadline !== null && story.daysLeft !== null) {
    if (story.daysLeft < 0) pace = `Срок прошёл · осталось ${words(left)}`;
    else if (story.daysLeft === 0)
      pace = `Срок сегодня · осталось ${words(left)}`;
    else if (story.perDay !== null)
      pace = `к ${fmtDay(story.deadline)}: осталось ${story.daysLeft} дн. · около ${words(story.perDay)} в день`;
  }
  return (
    <div className="grid gap-2">
      <p className="text-caption font-medium">
        {story.deadline === null
          ? "Цель истории"
          : `Цель истории к ${fmtDay(story.deadline)}`}
      </p>
      <p>
        <span className="text-heading-3 tabular-nums">{fmt(story.words)}</span>{" "}
        <span className="text-muted-foreground">из {words(story.goal)}</span>
      </p>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-status-in-progress"
          style={{
            width: `${Math.min(100, (story.words / story.goal) * 100)}%`,
          }}
        />
      </div>
      {pace !== null && (
        <p className="text-caption text-muted-foreground">{pace}</p>
      )}
    </div>
  );
}

type GoalField = "daily_word_goal" | "word_goal" | "goal_deadline";

/** An empty field takes the goal away; anything else goes to the core, which names what it refuses. */
function goalValue(text: string): number | string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  return /^\d+$/.test(trimmed) ? Number(trimmed) : trimmed;
}

/** The field the core named in its refusal («Поле «word_goal» …»), if any. */
function refusedField(message: string): GoalField | null {
  for (const name of ["daily_word_goal", "word_goal", "goal_deadline"] as const)
    if (message.includes(`«${name}»`)) return name;
  return null;
}

function GoalForm({
  writing,
  project,
  onDone,
  onCancel,
}: {
  writing: Writing;
  project: Project;
  onDone: () => void;
  onCancel: () => void;
}) {
  const setDailyGoal = useDailyGoal();
  const { mutateAsync: updateProject } = useUpdate();
  const [daily, setDaily] = useState(
    writing.dailyGoal === null ? "" : String(writing.dailyGoal),
  );
  const [goal, setGoal] = useState(
    project.wordGoal === null ? "" : String(project.wordGoal),
  );
  const [deadline, setDeadline] = useState(project.goalDeadline ?? "");
  const [saving, setSaving] = useState(false);
  const [refusal, setRefusal] = useState<{
    field: GoalField | null;
    message: string;
  } | null>(null);

  const save = async () => {
    setSaving(true);
    setRefusal(null);
    try {
      const dailyValue = goalValue(daily);
      if (dailyValue !== writing.dailyGoal)
        await setDailyGoal(dailyValue as number | null);
      const goalValueNow = goalValue(goal);
      const deadlineValue = deadline === "" ? null : deadline;
      if (
        goalValueNow !== project.wordGoal ||
        deadlineValue !== project.goalDeadline
      )
        await updateProject({
          resource: "projects",
          id: project.id,
          values: { wordGoal: goalValueNow, goalDeadline: deadlineValue },
          successNotification: false,
          errorNotification: false,
        });
      onDone();
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setRefusal({ field: refusedField(message), message });
    } finally {
      setSaving(false);
    }
  };

  const error = (field: GoalField) =>
    refusal?.field === field ? refusal.message : undefined;

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <div className="grid gap-4 md:grid-cols-3">
        <GoalInput
          label="Слов в день"
          value={daily}
          onChange={setDaily}
          hint="Для всех ваших историй"
          error={error("daily_word_goal")}
          numeric
        />
        <GoalInput
          label="Цель истории, слов"
          value={goal}
          onChange={setGoal}
          error={error("word_goal")}
          numeric
        />
        <GoalInput
          label="Срок"
          value={deadline}
          onChange={setDeadline}
          hint="Можно без срока — оставьте пустым"
          error={error("goal_deadline")}
          date
        />
      </div>
      {refusal !== null && refusal.field === null && (
        <p className="text-caption text-destructive">{refusal.message}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={saving}>
          Сохранить
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={saving}
          onClick={onCancel}
        >
          Отмена
        </Button>
      </div>
    </form>
  );
}

function GoalInput({
  label,
  value,
  onChange,
  hint,
  error,
  numeric = false,
  date = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
  error?: string;
  numeric?: boolean;
  date?: boolean;
}) {
  const id = useId();
  return (
    <div className="grid content-start gap-1.5">
      <Label
        htmlFor={id}
        className="text-caption font-normal text-muted-foreground"
      >
        {label}
      </Label>
      <Input
        id={id}
        type={date ? "date" : "text"}
        inputMode={numeric ? "numeric" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={error !== undefined}
        className="bg-paper"
      />
      {error !== undefined ? (
        <p className="text-caption text-destructive">{error}</p>
      ) : (
        hint !== undefined && (
          <p className="text-caption text-muted-foreground">{hint}</p>
        )
      )}
    </div>
  );
}
