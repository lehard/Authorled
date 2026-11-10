import { Download, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";
import Markdown from "react-markdown";

import { Button } from "@/components/ui/button";
import { useStoryFiles } from "@/data/files";
import type { NoteFile } from "@/data/model";

import { noteFileKind, saveBlob } from "./noteFile";

type Loaded =
  | { state: "loading" }
  | { state: "failed"; reason: string }
  | { state: "pdf"; url: string }
  | { state: "html"; html: string }
  | { state: "markdown"; text: string };

function reasonOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * HTML of a DOCX for the sheet (design of note-originals-view, decision 4): mammoth turns the document
 * into plain HTML, DOMPurify keeps only safe markup. Pictures stay only when they are inside the file
 * (`data:`), links only to web pages and mail, and nothing of the file is loaded from outside.
 */
async function htmlOfDocx(blob: Blob): Promise<string> {
  const [{ default: mammoth }, { default: DOMPurify }] = await Promise.all([
    import("mammoth"),
    import("dompurify"),
  ]);
  const { value } = await mammoth.convertToHtml({
    arrayBuffer: await blob.arrayBuffer(),
  });
  const purify = DOMPurify();
  purify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "IMG") {
      const src = node.getAttribute("src") ?? "";
      if (!src.startsWith("data:image/")) node.remove();
    }
    if (node.tagName === "A") {
      const href = node.getAttribute("href") ?? "";
      if (!/^(https?:|mailto:|#)/i.test(href)) node.removeAttribute("href");
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
  return purify.sanitize(value, {
    FORBID_TAGS: ["style", "link", "iframe", "object", "embed", "form"],
    FORBID_ATTR: ["style", "srcset"],
  });
}

async function load(file: NoteFile, blob: Blob): Promise<Loaded> {
  switch (noteFileKind(file)) {
    case "pdf":
      return {
        state: "pdf",
        url: URL.createObjectURL(new Blob([blob], { type: "application/pdf" })),
      };
    case "docx":
      return { state: "html", html: await htmlOfDocx(blob) };
    case "md":
      return {
        state: "markdown",
        text: new TextDecoder("utf-8", { fatal: true }).decode(
          await blob.arrayBuffer(),
        ),
      };
    default:
      throw new Error(`Оригинал «${file.name}» не показывается как документ.`);
  }
}

/**
 * The original of a note as it is: PDF by the browser, DOCX and Markdown as a document on a sheet.
 * The parent keys it by the file, so another file starts from «loading».
 */
export function NoteOriginal({ file }: { file: NoteFile }) {
  const files = useStoryFiles();
  const [loaded, setLoaded] = useState<Loaded>({ state: "loading" });
  const [blob, setBlob] = useState<Blob | null>(null);

  useEffect(() => {
    let alive = true;
    let url: string | null = null;
    files
      .content(file.id)
      .then(async (content) => {
        const shown = await load(file, content);
        if (shown.state === "pdf") url = shown.url;
        if (!alive) {
          if (url !== null) URL.revokeObjectURL(url);
          return;
        }
        setBlob(content);
        setLoaded(shown);
      })
      .catch((error: unknown) => {
        if (alive) setLoaded({ state: "failed", reason: reasonOf(error) });
      });
    return () => {
      alive = false;
      if (url !== null) URL.revokeObjectURL(url);
    };
    // The bytes of an original never change: it is read again only for another file.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [file.id]);

  switch (loaded.state) {
    case "loading":
      return (
        <div className="sheet sheet-prose text-muted-foreground" aria-busy>
          Открываем оригинал…
        </div>
      );
    case "failed":
      return (
        <div className="sheet sheet-prose grid justify-items-start gap-3">
          <p role="alert" className="text-destructive">
            Оригинал не показывается: {loaded.reason}
          </p>
          <DownloadButton file={file} blob={blob} />
        </div>
      );
    case "pdf":
      return (
        <div className="mx-auto grid w-full max-w-[1100px] gap-2">
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => window.open(loaded.url, "_blank", "noopener")}
            >
              <ExternalLink />
              Открыть в новой вкладке
            </Button>
          </div>
          <iframe
            aria-label={`Оригинал: ${file.name}`}
            src={loaded.url}
            className="h-[calc(100dvh-14rem)] min-h-[480px] w-full rounded-md bg-paper shadow-paper"
          />
        </div>
      );
    case "html":
      return (
        <div
          className="sheet sheet-prose sheet-doc"
          aria-label={`Оригинал: ${file.name}`}
          // Sanitized by DOMPurify in htmlOfDocx.
          dangerouslySetInnerHTML={{ __html: loaded.html }}
        />
      );
    case "markdown":
      return (
        <div
          className="sheet sheet-prose sheet-doc"
          aria-label={`Оригинал: ${file.name}`}
        >
          <Markdown
            components={{
              // Pictures of a Markdown file live outside it: not loaded, only named with their address.
              img: ({ src, alt }) => (
                <span className="text-muted-foreground">
                  [{alt !== undefined && alt !== "" ? alt : "картинка"}:{" "}
                  {typeof src === "string" ? src : ""}]
                </span>
              ),
              a: ({ href, children }) => (
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {children}
                </a>
              ),
            }}
          >
            {loaded.text}
          </Markdown>
        </div>
      );
  }
}

/** «Скачать»: the original with its own name. */
export function DownloadButton({
  file,
  blob,
}: {
  file: NoteFile;
  blob?: Blob | null;
}) {
  const files = useStoryFiles();
  const [error, setError] = useState<string | null>(null);

  async function download() {
    setError(null);
    try {
      saveBlob(blob ?? (await files.content(file.id)), file.name);
    } catch (err) {
      setError(reasonOf(err));
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="rounded-full"
        onClick={() => void download()}
      >
        <Download />
        Скачать
      </Button>
      {error !== null && (
        <p role="alert" className="w-full text-caption text-destructive">
          {error}
        </p>
      )}
    </>
  );
}
