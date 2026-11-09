import { MoreHorizontal, Palette, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";

import { projectScreen } from "@/app/screens";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MANUSCRIPT_TYPES } from "@/data/files";
import { useProjects } from "@/data/hooks";
import { COVER_COLORS, isCoverColor, type Project } from "@/data/model";
import { NameDialog } from "@/screens/shared/NameDialog";
import { DataErrorScreen } from "@/screens/system/DataErrorScreen";
import { MessageScreen } from "@/screens/system/MessageScreen";
import "@/screens/workspace.css";

import { TopBar } from "./TopBar";
import { useStoryActions } from "./storyActions";

const updated = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "long",
});

/** Shelf of stories (openspec/specs/web/workspace, «Полка историй»). */
const DRAFT_WORDS: Partial<Record<Intl.LDMLPluralRule, string>> = {
  one: "драфт",
  few: "драфта",
  many: "драфтов",
};
const plural = new Intl.PluralRules("ru");

function draftsLabel(count: number): string {
  const word = DRAFT_WORDS[plural.select(count)];
  if (word === undefined)
    throw new Error(`Нет формы слова «драфт» для ${count}.`);
  return `${count} ${word}`;
}

export function ShelfScreen() {
  const navigate = useNavigate();
  const { projects, query } = useProjects(false);
  const { projects: trash, query: trashQuery } = useProjects(true);
  const { createStory, renameStory, setCoverColor, trashStory } =
    useStoryActions();
  const [creating, setCreating] = useState(false);
  const [renaming, setRenaming] = useState<Project | null>(null);
  // The stories are on screen: the story window loads in the background, so opening a story
  // does not wait for it (openspec/specs/web/app, «Фоновая подгрузка окна истории»).
  const shown = query.isSuccess && trashQuery.isSuccess;
  useEffect(() => {
    if (shown) projectScreen.preload();
  }, [shown]);

  const failed = [query, trashQuery].find((q) => q.isError);
  if (failed?.error)
    return (
      <DataErrorScreen
        title="Истории не загрузились"
        error={failed.error}
        onRetry={() => {
          void query.refetch();
          void trashQuery.refetch();
        }}
      />
    );
  if (query.isPending || trashQuery.isPending)
    return <MessageScreen loading title="Загружаем истории…" />;

  return (
    <div className="min-h-dvh">
      <TopBar />
      <main className="mx-auto max-w-[1200px] px-4 pt-4 pb-16 md:px-10 md:pt-7">
        <h1 className="font-heading mt-2 mb-9 text-[clamp(44px,6vw,68px)] leading-[1.05] font-medium tracking-[-0.02em]">
          Истории
        </h1>
        <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-[repeat(auto-fill,240px)] sm:gap-x-[26px] sm:gap-y-8">
          {projects.map((p) => (
            <div
              key={p.id}
              className="group/card relative grid content-start gap-3.5"
            >
              <Link
                to={`/p/${p.id}/text`}
                className="grid content-start gap-3.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <span className="book" data-cover={p.coverColor}>
                  {p.title}
                </span>
                <span className="grid gap-0.5 px-0.5">
                  <b className="font-heading text-[19px] font-semibold">
                    {p.title}
                  </b>
                  <small className="text-caption text-muted-foreground">
                    Полный метр · изменено{" "}
                    {updated.format(new Date(p.updatedAt))}
                    {p.draftsCount > 1 && ` · ${draftsLabel(p.draftsCount)}`}
                  </small>
                  {p.desc !== "" && (
                    <span className="mt-1 line-clamp-2 text-caption text-muted-foreground">
                      {p.desc}
                    </span>
                  )}
                </span>
              </Link>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="secondary"
                    size="icon-sm"
                    className="absolute top-2.5 right-2.5 rounded-full bg-paper/85 opacity-0 group-hover/card:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100 max-md:opacity-100"
                    aria-label={`Действия с историей «${p.title}»`}
                  >
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-auto">
                  <DropdownMenuItem onSelect={() => setRenaming(p)}>
                    Переименовать
                  </DropdownMenuItem>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      <Palette />
                      Цвет обложки
                    </DropdownMenuSubTrigger>
                    <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup
                        value={p.coverColor}
                        onValueChange={(value) => {
                          if (!isCoverColor(value))
                            throw new Error(`Нет цвета обложки «${value}».`);
                          void setCoverColor(p.id, value);
                        }}
                      >
                        {Object.entries(COVER_COLORS).map(([color, label]) => (
                          <DropdownMenuRadioItem key={color} value={color}>
                            <span
                              className="cover-swatch"
                              data-cover={color}
                              aria-hidden
                            />
                            {label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    </DropdownMenuSubContent>
                  </DropdownMenuSub>
                  <DropdownMenuItem
                    variant="destructive"
                    onSelect={() => void trashStory(p.id, true)}
                  >
                    <Trash2 />
                    Удалить в корзину
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ))}
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="group/new grid content-start gap-3.5 text-left"
          >
            <span className="grid aspect-[3/4] place-items-center rounded-[10px] border-[1.5px] border-dashed border-border-strong text-muted-foreground transition-colors group-hover/new:border-primary group-hover/new:text-primary">
              <Plus className="size-8" strokeWidth={1.4} />
            </span>
            <span className="grid gap-0.5 px-0.5">
              <b className="font-heading text-[19px] font-semibold">
                Новая история
              </b>
              <small className="text-caption text-muted-foreground">
                Полнометражный сценарий
              </small>
            </span>
          </button>
        </div>
        {trash.length > 0 && (
          <div className="mt-10 flex justify-center">
            <Button asChild variant="ghost" className="rounded-full">
              <Link to="/trash">
                <Trash2 />
                Корзина · {trash.length}
              </Link>
            </Button>
          </div>
        )}
      </main>

      <NameDialog
        open={creating}
        onOpenChange={setCreating}
        title="Новая история"
        description="Полнометражный сценарий. Название можно поменять потом."
        label="Название"
        submitLabel="Создать"
        emptyError="Введите название истории."
        file={{
          label: "Рукопись (необязательно)",
          accept: MANUSCRIPT_TYPES,
          hint: "Fountain, Final Draft, STARC, DOCX или TXT: история создастся из текста файла.",
        }}
        onSubmit={async (title, file) => {
          const id = await createStory(title, file);
          navigate(`/p/${id}/text`);
        }}
      />
      <NameDialog
        open={renaming !== null}
        onOpenChange={(open) => !open && setRenaming(null)}
        title="Переименовать историю"
        label="Название"
        initial={renaming?.title ?? ""}
        submitLabel="Сохранить"
        emptyError="Введите название истории."
        onSubmit={async (title) => {
          if (renaming === null)
            throw new Error("Нет истории для переименования.");
          await renameStory(renaming.id, title);
        }}
      />
    </div>
  );
}
