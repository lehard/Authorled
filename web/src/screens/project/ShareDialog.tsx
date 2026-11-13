import { Copy, Link2, Share2, X } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router";

import { useAccount } from "@/account/useAccount";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { STORY_ROLES, type Member, type StoryRole } from "@/data/model";
import { useMembers, useReadLink, useSharingActions } from "@/data/sharing";
import { ConfirmDialog } from "@/screens/shared/ConfirmDialog";

import { useProjectData } from "./ProjectContext";

// The window «Поделиться» of a story (openspec/specs/web/workspace, «Окно «Поделиться»», «Ссылка
// «почитать» в окне»): participants with their roles, invitations by e-mail and the link «почитать»
// of the open draft. The core checks every action by the role; the window only hides what it
// would refuse.

const GIVEN: StoryRole[] = ["coauthor", "reviewer", "reader"];

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/** The address of the page that reads a draft by the key of its link. */
function readLinkUrl(key: string): string {
  return `${window.location.origin}/read/${key}`;
}

export function ShareDialog() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="mx-2 mb-1 justify-start gap-2 rounded-full"
        onClick={() => setOpen(true)}
      >
        <Share2 />
        Поделиться
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90dvh] overflow-auto rounded-panel bg-paper shadow-paper sm:max-w-lg">
          {open && <ShareContent />}
        </DialogContent>
      </Dialog>
    </>
  );
}

function ShareContent() {
  const { project, draft, can } = useProjectData();
  const { data: account } = useAccount();
  const { members, error, reload } = useMembers(project.id, true);
  const actions = useSharingActions();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const self = members?.members.find((m) => m.email === account?.email);

  async function act(run: () => Promise<unknown>) {
    setFailure(null);
    try {
      await run();
      await reload();
    } catch (e) {
      setFailure(errorText(e));
    }
  }

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="text-heading-2">Поделиться</DialogTitle>
        <DialogDescription>
          Участники видят всю историю «{project.title}»: драфты, героев, мир и
          заметки.
        </DialogDescription>
      </DialogHeader>
      {can.owner && <InviteForm projectId={project.id} onInvited={reload} />}
      <section className="grid gap-2" aria-label="Участники">
        {error !== null && error !== undefined && (
          <p role="alert" className="text-caption text-destructive">
            {errorText(error)}
          </p>
        )}
        {members === undefined && error == null && (
          <p className="text-caption text-muted-foreground">
            Загружаем участников…
          </p>
        )}
        {members?.members.map((m) => (
          <MemberRow
            key={m.userId}
            member={m}
            manage={can.owner && m.role !== "owner"}
            onRole={(role) =>
              void act(() => actions.setRole(project.id, m.userId, role))
            }
            onRemove={() =>
              void act(() => actions.remove(project.id, m.userId))
            }
          />
        ))}
        {members?.invitations.map((i) => (
          <div
            key={i.id}
            className="flex flex-wrap items-center gap-2 rounded-xl bg-panel px-3 py-2"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate">{i.email}</span>
              <small className="text-caption text-muted-foreground">
                {STORY_ROLES[i.role]} · ждёт входа
              </small>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="rounded-full"
              onClick={() => void act(() => actions.revoke(i.id))}
            >
              Отозвать
            </Button>
          </div>
        ))}
      </section>
      {can.edit && (
        <ReadLinkSection draftId={draft.id} draftName={draft.name} />
      )}
      {failure !== null && (
        <p role="alert" className="text-caption text-destructive">
          {failure}
        </p>
      )}
      {self !== undefined && self.role !== "owner" && (
        <>
          <Button
            variant="ghost"
            className="justify-self-start rounded-full text-destructive"
            onClick={() => setLeaving(true)}
          >
            Выйти из истории
          </Button>
          <ConfirmDialog
            open={leaving}
            onOpenChange={setLeaving}
            title="Выйти из истории?"
            text={`История «${project.title}» пропадёт с вашей полки. Вернуться можно только по новому приглашению владельца.`}
            actionLabel="Выйти"
            onConfirm={() => {
              setLeaving(false);
              setFailure(null);
              actions
                .leave(project.id, self.userId)
                .then(() => navigate("/"))
                .catch((e: unknown) => setFailure(errorText(e)));
            }}
          />
        </>
      )}
    </div>
  );
}

function InviteForm({
  projectId,
  onInvited,
}: {
  projectId: string;
  onInvited: () => Promise<unknown>;
}) {
  const id = useId();
  const actions = useSharingActions();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StoryRole>("reviewer");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      setError("Нужна почта вида name@example.ru.");
      return;
    }
    setBusy(true);
    try {
      await actions.invite(projectId, email.trim(), role);
      setEmail("");
      await onInvited();
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="grid gap-2" noValidate>
      <Label htmlFor={`${id}-email`}>Пригласить по почте</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${id}-email`}
          type="email"
          value={email}
          placeholder="name@example.ru"
          className="min-w-[12rem] flex-1 bg-paper"
          aria-invalid={error !== null}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
        />
        <Select value={role} onValueChange={(v) => setRole(v as StoryRole)}>
          <SelectTrigger className="w-40 bg-paper" aria-label="Роль">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {GIVEN.map((r) => (
              <SelectItem key={r} value={r}>
                {STORY_ROLES[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" className="rounded-full" disabled={busy}>
          Пригласить
        </Button>
      </div>
      {error !== null && (
        <p role="alert" className="text-caption text-destructive">
          {error}
        </p>
      )}
      <p className="text-caption text-muted-foreground">
        Письмо не отправляется: сообщите приглашённому адрес сервиса сами.
        История появится у него на полке, когда он войдёт под этой почтой.
      </p>
    </form>
  );
}

function MemberRow({
  member,
  manage,
  onRole,
  onRemove,
}: {
  member: Member;
  manage: boolean;
  onRole: (role: StoryRole) => void;
  onRemove: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl bg-panel px-3 py-2">
      <span className="min-w-0 flex-1">
        <span className="block truncate">{member.name}</span>
        <small className="block truncate text-caption text-muted-foreground">
          {member.email}
        </small>
      </span>
      {manage ? (
        <>
          <Select
            value={member.role}
            onValueChange={(v) => onRole(v as StoryRole)}
          >
            <SelectTrigger
              className="w-36 bg-paper"
              aria-label={`Роль: ${member.name}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {GIVEN.map((r) => (
                <SelectItem key={r} value={r}>
                  {STORY_ROLES[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label={`Убрать: ${member.name}`}
            onClick={onRemove}
          >
            <X />
          </Button>
        </>
      ) : (
        <small className="text-caption text-muted-foreground">
          {STORY_ROLES[member.role]}
        </small>
      )}
    </div>
  );
}

function ReadLinkSection({
  draftId,
  draftName,
}: {
  draftId: string;
  draftName: string;
}) {
  const { link, error, reload } = useReadLink(draftId, true);
  const actions = useSharingActions();
  const [failure, setFailure] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  async function act(run: () => Promise<unknown>) {
    setFailure(null);
    setCopied(false);
    try {
      await run();
      await reload();
    } catch (e) {
      setFailure(errorText(e));
    }
  }

  return (
    <section className="grid gap-2" aria-label="Ссылка почитать">
      <h3 className="flex items-center gap-2 font-semibold">
        <Link2 className="size-4" />
        Ссылка почитать
      </h3>
      <p className="text-caption text-muted-foreground">
        По ссылке без входа виден только текст сценария драфта «{draftName}»:
        без героев, мира, заметок и комментариев.
      </p>
      {error !== null && error !== undefined && (
        <p role="alert" className="text-caption text-destructive">
          {errorText(error)}
        </p>
      )}
      {link === null && (
        <Button
          variant="outline"
          className="justify-self-start rounded-full"
          onClick={() => void act(() => actions.createLink(draftId))}
        >
          Создать ссылку
        </Button>
      )}
      {link !== null && link !== undefined && (
        <div className="flex flex-wrap items-center gap-2">
          <Input
            readOnly
            value={readLinkUrl(link.key)}
            aria-label="Адрес ссылки"
            className="min-w-[12rem] flex-1 bg-paper"
            onFocus={(e) => e.target.select()}
          />
          <Button
            variant="outline"
            className="rounded-full"
            onClick={() => {
              setFailure(null);
              navigator.clipboard.writeText(readLinkUrl(link.key)).then(
                () => setCopied(true),
                (e: unknown) => setFailure(errorText(e)),
              );
            }}
          >
            <Copy />
            {copied ? "Скопировано" : "Скопировать"}
          </Button>
          <Button
            variant="ghost"
            className="rounded-full text-destructive"
            onClick={() => void act(() => actions.removeLink(draftId))}
          >
            Отключить
          </Button>
        </div>
      )}
      {failure !== null && (
        <p role="alert" className="text-caption text-destructive">
          {failure}
        </p>
      )}
    </section>
  );
}
