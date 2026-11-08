import { Plugin, PluginKey } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

// US Letter at 96 dpi: 11" page, 1" margins, so 9" (864px) of text per page.
const MARGIN_BOTTOM = 96;
const CONTENT_H = 864;

export const paginationKey = new PluginKey<DecorationSet>("pagination");

// A character cue is not left at the bottom of a page without its speech.
const KEEP_WITH_PREV = new Set(["dialogue", "parenthetical", "lyrics"]);

type BlockInfo = { pos: number; height: number; typeName: string };

export const paginationPlugin = new Plugin<DecorationSet>({
  key: paginationKey,
  state: {
    init: () => DecorationSet.empty,
    apply(tr, old) {
      return tr.getMeta(paginationKey) ?? old.map(tr.mapping, tr.doc);
    },
  },
  props: {
    decorations(state) {
      return paginationKey.getState(state);
    },
  },
  view(editorView) {
    let frame: number | null = null;
    let lastJson = "";

    function measure() {
      // The view may be destroyed before the frame runs (StrictMode mounts twice).
      if (editorView.isDestroyed) return;
      const { state } = editorView;
      const blocks: BlockInfo[] = [];
      state.doc.forEach((node, offset) => {
        if (node.type.name === "pageBreak") return;
        const dom = editorView.nodeDOM(offset);
        if (!(dom instanceof HTMLElement)) {
          throw new Error(
            `Разметка страниц: нет DOM для абзаца в позиции ${offset}`,
          );
        }
        const style = window.getComputedStyle(dom);
        const height =
          dom.offsetHeight +
          parseFloat(style.marginTop) +
          parseFloat(style.marginBottom);
        blocks.push({ pos: offset, height, typeName: node.type.name });
      });

      const breaks: number[] = [];
      let accumulated = 0;
      for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        if (accumulated + block.height > CONTENT_H && accumulated > 0) {
          let breakIdx = i;
          if (KEEP_WITH_PREV.has(block.typeName)) {
            let j = i - 1;
            while (j >= 0 && KEEP_WITH_PREV.has(blocks[j].typeName)) j--;
            if (j > 0 && blocks[j].typeName === "character") breakIdx = j;
          }
          breaks.push(blocks[breakIdx].pos);
          accumulated = 0;
          for (let k = breakIdx; k <= i; k++) accumulated += blocks[k].height;
        } else {
          accumulated += block.height;
        }
      }

      // The last page is padded to its full height, also when the breaks stay the same:
      // typing on the last page changes what is left of it.
      const padding = `${MARGIN_BOTTOM + Math.max(0, CONTENT_H - accumulated)}px`;
      if (editorView.dom.style.paddingBottom !== padding)
        editorView.dom.style.paddingBottom = padding;

      const json = JSON.stringify(breaks);
      if (json === lastJson) return;
      lastJson = json;

      const decorations = breaks.map((pos, idx) => {
        const num = idx + 2;
        return Decoration.widget(
          pos,
          () => {
            const wrapper = document.createElement("div");
            wrapper.className = "pw-page-separator";
            wrapper.contentEditable = "false";
            const bottom = document.createElement("div");
            bottom.className = "pw-page-margin-bottom";
            const top = document.createElement("div");
            top.className = "pw-page-margin-top";
            const label = document.createElement("span");
            label.className = "pw-page-header-number";
            label.textContent = `${num}.`;
            top.appendChild(label);
            wrapper.append(bottom, top);
            return wrapper;
          },
          { side: -1, key: `page-${num}` },
        );
      });

      const tr = state.tr.setMeta(
        paginationKey,
        DecorationSet.create(state.doc, decorations),
      );
      editorView.dispatch(tr.setMeta("addToHistory", false));
    }

    function schedule() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        frame = null;
        measure();
      });
    }

    // Fonts change the heights: measure again once they are loaded.
    requestAnimationFrame(schedule);
    void document.fonts.ready.then(schedule);

    // Heights change without an edit of the document too: suggested text shown in the line,
    // paragraphs hidden by beats or «only this scene», the width of the continuous sheet. Each
    // of them changes the height of the sheet, so one observer catches them all
    // (web/screenplay-editor, «Разрывы страниц по показанным высотам»). The callback only plans
    // a frame. New breaks and padding change the height again, but the next measure gives the
    // same breaks: they stand between paragraphs and do not change their heights.
    const sheet = new ResizeObserver(schedule);
    sheet.observe(editorView.dom);

    return {
      update(view, prevState) {
        if (view.state.doc !== prevState.doc) schedule();
      },
      destroy() {
        sheet.disconnect();
        if (frame !== null) cancelAnimationFrame(frame);
      },
    };
  },
});
