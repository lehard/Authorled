import { appConfig } from "@/app/config";

// The promise about the author's texts and the documents of the service on the product site
// (openspec/specs/web/workspace, «Обещание о текстах в чате», «Раздел «Ваши тексты» в настройках»).
// The full text for the sign-in screen and the settings, the short one for the empty conversation of
// the co-author chat, where the full one does not fit in a line; neither may promise more than the
// offer (design of no-training-in-app, D2).

export const NO_TRAINING = "Ваши тексты не используются для обучения моделей.";
export const NO_TRAINING_SHORT = "Не обучаем ИИ на ваших текстах.";

/** The offer on the product site; `section` is an anchor of the page, such as `materials`. */
export function offerUrl(section?: "materials"): string {
  const url = new URL("/legal/offer/", appConfig().siteOrigin).href;
  return section === undefined ? url : `${url}#${section}`;
}

/** The policy for personal data of the service on the product site. */
export function privacyUrl(): string {
  return new URL("/legal/privacy/", appConfig().siteOrigin).href;
}
