// The font of the synopsis page (design of synopsis-editor, decision 6): Tinos, metric-compatible with
// Times New Roman, from our build, under its own name. The page layout and the print window use it;
// the interface does not. The fonts of the device never take part.
import cyr400 from "@fontsource/tinos/files/tinos-cyrillic-400-normal.woff2?url";
import cyr400i from "@fontsource/tinos/files/tinos-cyrillic-400-italic.woff2?url";
import cyr700 from "@fontsource/tinos/files/tinos-cyrillic-700-normal.woff2?url";
import cyr700i from "@fontsource/tinos/files/tinos-cyrillic-700-italic.woff2?url";
import lat400 from "@fontsource/tinos/files/tinos-latin-400-normal.woff2?url";
import lat400i from "@fontsource/tinos/files/tinos-latin-400-italic.woff2?url";
import lat700 from "@fontsource/tinos/files/tinos-latin-700-normal.woff2?url";
import lat700i from "@fontsource/tinos/files/tinos-latin-700-italic.woff2?url";

export const PRINT_FONT = "Prose Print";

const UNICODE = {
  latin:
    "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  cyrillic: "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116",
};

type Face = [
  url: string,
  range: keyof typeof UNICODE,
  weight: number,
  style: string,
];

const FACES: Face[] = [
  [lat400, "latin", 400, "normal"],
  [lat400i, "latin", 400, "italic"],
  [lat700, "latin", 700, "normal"],
  [lat700i, "latin", 700, "italic"],
  [cyr400, "cyrillic", 400, "normal"],
  [cyr400i, "cyrillic", 400, "italic"],
  [cyr700, "cyrillic", 700, "normal"],
  [cyr700i, "cyrillic", 700, "italic"],
];

const absolute = (url: string) => new URL(url, window.location.href).href;

/** `@font-face` rules for the print window, with absolute addresses of our build. */
export function printFontFaces(): string {
  return FACES.map(
    ([url, range, weight, style]) =>
      `@font-face { font-family: "${PRINT_FONT}"; font-weight: ${weight}; font-style: ${style}; src: url("${absolute(url)}") format("woff2"); unicode-range: ${UNICODE[range]}; }`,
  ).join("\n");
}

let loaded: Promise<void> | null = null;

/** Loads every face into this document once; a face that does not load is an error, not another font. */
export function loadPrintFont(): Promise<void> {
  loaded ??= Promise.all(
    FACES.map(async ([url, range, weight, style]) => {
      const face = new FontFace(PRINT_FONT, `url("${absolute(url)}")`, {
        weight: String(weight),
        style,
        unicodeRange: UNICODE[range],
      });
      try {
        await face.load();
      } catch (error) {
        throw new Error(
          `Шрифт страницы синопсиса не загрузился (${range}, ${weight}, ${style}): ${String(error)}`,
          { cause: error },
        );
      }
      document.fonts.add(face);
    }),
  ).then(() => undefined);
  return loaded;
}
