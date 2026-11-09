import { useCustom, useCustomMutation } from "@refinedev/core";

// Writing of the author (openspec/specs/api/writing) through the `custom` operations of the data
// source: the statistics of a draft in the time zone of the browser and the daily goal of the
// author. The core counts the words, the days and the pace; the screens only show them.

export type WritingDay = {
  /** `YYYY-MM-DD` in the time zone of the request. */
  date: string;
  /** Words written that day in all stories; null when the author saved nothing (a gap). */
  words: number | null;
  /** Whether the day met the daily goal; null without words or without a goal. */
  met: boolean | null;
};

export type StoryGoal = {
  /** Words in the screenplay of the draft now. */
  words: number;
  goal: number | null;
  /** `YYYY-MM-DD` or null. */
  deadline: string | null;
  daysLeft: number | null;
  /** Words a day to meet the goal by the deadline; 0 when it is met. */
  perDay: number | null;
};

export type Writing = {
  today: string;
  dailyGoal: number | null;
  /** The last 30 days, the last one is today. */
  days: WritingDay[];
  story: StoryGoal;
};

export type WritingOperation =
  | { operation: "writing"; payload: { draftId: string; tz: string } }
  | { operation: "setDailyGoal"; payload: { goal: number | null } };

const quiet = { successNotification: false, errorNotification: false } as const;

/**
 * The time zone of the browser by its IANA name; none is assumed when the browser gives none
 * (openspec/specs/web/workspace, «Отказы блока «Письмо»»).
 */
export function browserZone(): string | null {
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return typeof zone === "string" && zone !== "" ? zone : null;
}

/** The statistics of a draft; nothing is asked while `tz` is null. */
export function useWriting(draftId: string, tz: string | null) {
  const { query, result } = useCustom<Writing>({
    url: "writing",
    method: "get",
    config: { payload: { draftId, tz } },
    meta: { operation: "writing" },
    queryOptions: { enabled: tz !== null, retry: false },
    ...quiet,
  });
  return {
    writing: tz === null ? undefined : (result.data as Writing | undefined),
    error: query.error,
    loading: query.isLoading,
    reload: () => query.refetch(),
  };
}

export function useDailyGoal() {
  const { mutateAsync } = useCustomMutation();
  return async (goal: number | null): Promise<void> => {
    const op: WritingOperation = {
      operation: "setDailyGoal",
      payload: { goal },
    };
    await mutateAsync({
      url: op.operation,
      method: "post",
      values: op.payload,
      meta: { operation: op.operation },
      ...quiet,
    });
  };
}
