/** «сегодня, 09:12», «вчера, 18:40», otherwise the date (screenplay-comments, decision 3). */
export function commentTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const time = at.toLocaleTimeString("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(now) - day(at)) / 86_400_000);
  if (days === 0) return `сегодня, ${time}`;
  if (days === 1) return `вчера, ${time}`;
  const date = at.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: at.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
  return `${date}, ${time}`;
}
