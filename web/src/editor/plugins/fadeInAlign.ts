import { Plugin, PluginKey } from "prosemirror-state";

const fadeInAlignKey = new PluginKey("fadeInAlign");

/**
 * Keeps the `pw-fade-in` class of transitions in step with their text: «FADE IN:» and
 * «ИЗ ЗТМ:» stand on the left. toDOM does not run again while the author types.
 */
export function createFadeInAlignPlugin() {
  return new Plugin({
    key: fadeInAlignKey,
    view() {
      return {
        update(view) {
          view.dom.querySelectorAll(".pm-transition").forEach((el) => {
            const text = (el.textContent ?? "").toUpperCase().trim();
            el.classList.toggle(
              "pw-fade-in",
              /^(FADE\s+IN|ИЗ\s+ЗТМ)[.:]?$/.test(text),
            );
          });
        },
      };
    },
  });
}
