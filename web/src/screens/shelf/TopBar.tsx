import { Link } from "react-router";

import { UserMenu } from "@/screens/shared/UserMenu";

export function TopBar() {
  return (
    <header className="flex h-16 items-center gap-3 px-4 md:px-7">
      <Link
        to="/"
        className="font-heading flex items-center gap-2.5 text-[19px]"
      >
        <img src="/brand-mark.svg" alt="" width={28} height={28} />
        Соавтор
      </Link>
      <span className="flex-1" />
      <UserMenu />
    </header>
  );
}
