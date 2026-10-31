import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  text: string;
  actionLabel: string;
  onConfirm: () => void;
};

/** Confirmation of an action that cannot be undone. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  text,
  actionLabel,
  onConfirm,
}: Props) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="rounded-panel bg-paper shadow-paper">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-heading-2">
            {title}
          </AlertDialogTitle>
          <AlertDialogDescription>{text}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            className="rounded-full"
            onClick={onConfirm}
          >
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
