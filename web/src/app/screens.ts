import { lazyScreen } from "./lazyScreen";

// Parts loaded only when opened (openspec/specs/web/app, «Окно истории отдельной частью»).
export const projectScreen = lazyScreen(
  "окно истории",
  () => import("@/screens/project/ProjectScreen").then((m) => m.ProjectScreen),
  "Открываем историю…",
);

export const showcaseScreen = lazyScreen(
  "витрина",
  () => import("@/showcase/Showcase").then((m) => m.Showcase),
  "Открываем витрину…",
);

export const readScreen = lazyScreen(
  "страница чтения",
  () => import("@/screens/read/ReadScreen").then((m) => m.ReadScreen),
  "Открываем сценарий…",
);
