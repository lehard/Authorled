import { Link } from "react-router";

import { Button } from "@/components/ui/button";

import { MessageScreen } from "./MessageScreen";

export function NotFoundScreen() {
  return (
    <MessageScreen
      title="Не найдено"
      text="Такой страницы, истории или документа нет."
    >
      <Button asChild className="rounded-full">
        <Link to="/">К историям</Link>
      </Button>
    </MessageScreen>
  );
}
