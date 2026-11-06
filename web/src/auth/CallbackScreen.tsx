import { ErrorResponse } from "oidc-client-ts";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";

import { MessageScreen } from "@/screens/system/MessageScreen";
import { Button } from "@/components/ui/button";

import {
  completeSignIn,
  SIGN_IN_TIMEOUT_MS,
  SIGN_IN_TIMEOUT_REASON,
  type ReturnState,
} from "./userManager";

function isReturnState(value: unknown): value is ReturnState {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as ReturnState).returnTo === "string"
  );
}

function reason(error: unknown): string {
  if (error instanceof ErrorResponse)
    return error.error_description ?? error.error ?? error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Return address of Authentik: exchanges the code and opens the page the user came from. */
export function CallbackScreen() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeSignIn()
      .then((user) => {
        if (!isReturnState(user.state))
          throw new Error("Вход вернулся без адреса возврата.");
        navigate(user.state.returnTo, { replace: true });
      })
      .catch((e: unknown) => setError(reason(e)));
  }, [navigate]);

  // The exchange may hang without a failure; a reason that came first stays.
  useEffect(() => {
    const timer = window.setTimeout(
      () => setError((e) => e ?? SIGN_IN_TIMEOUT_REASON),
      SIGN_IN_TIMEOUT_MS,
    );
    return () => window.clearTimeout(timer);
  }, []);

  if (error === null) return <MessageScreen loading title="Входим…" />;
  return (
    <MessageScreen title="Не удалось войти" text={error}>
      <Button onClick={() => navigate("/login")}>Попробовать снова</Button>
    </MessageScreen>
  );
}
