import { useLogout } from "@refinedev/core";
import { LogOut, RotateCw, Settings } from "lucide-react";
import { Link } from "react-router";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAccount } from "@/account/useAccount";
import { appConfig } from "@/app/config";

/** Avatar button with the account, settings, the data-source label and sign-out. */
export function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data: me, error, refetch } = useAccount();
  const { mutate: logout, error: logoutError } = useLogout();
  const name = me?.name ?? (error !== null ? "Аккаунт" : "…");
  return (
    <>
      {logoutError !== null && (
        <p
          role="alert"
          className="fixed bottom-4 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-2xl bg-paper px-4 py-2.5 text-caption text-destructive shadow-paper"
        >
          Не удалось выйти: {logoutError.message}
        </p>
      )}
      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex h-9 items-center gap-2 rounded-full bg-panel pr-3 pl-1 text-sm shadow-panel outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
          aria-label="Меню пользователя"
        >
          <span className="grid size-7 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {name.slice(0, 1).toUpperCase()}
          </span>
          {!compact && <span className="max-w-40 truncate">{name}</span>}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {error !== null ? (
            <>
              <DropdownMenuLabel
                role="alert"
                className="text-caption font-normal text-destructive"
              >
                Аккаунт не загрузился: {error.message}
              </DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => void refetch()}>
                <RotateCw />
                Повторить
              </DropdownMenuItem>
            </>
          ) : (
            <DropdownMenuLabel className="grid gap-0.5">
              <span className="truncate font-medium">{name}</span>
              <span className="truncate text-caption font-normal text-muted-foreground">
                {me?.email}
              </span>
            </DropdownMenuLabel>
          )}
          {appConfig().dataSource === "fixtures" && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel className="text-caption font-normal text-muted-foreground">
                Данные примера: правки живут до перезагрузки страницы
              </DropdownMenuLabel>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link to="/settings">
              <Settings />
              Настройки
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => logout()}>
            <LogOut />
            Выйти
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
