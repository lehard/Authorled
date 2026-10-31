import {
  useRef,
  useState,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";

const LENGTH = 6;
const EMPTY: string[] = Array<string>(LENGTH).fill("");

type Props = {
  invalid: boolean;
  disabled: boolean;
  onComplete: (code: string) => void;
  /** Changing the key clears the cells (after a wrong code). */
  resetKey: number;
};

/** Six cells of the code from the e-mail (mockup v1, #auth/light/code). */
export function CodeInput(props: Props) {
  return <Cells key={props.resetKey} {...props} />;
}

function Cells({ invalid, disabled, onComplete }: Props) {
  // The typed digits live in a ref too: keystrokes can arrive faster than React re-renders,
  // and each one must see the digits of the previous one.
  const typed = useRef<string[]>(EMPTY);
  const [digits, setDigits] = useState<string[]>(EMPTY);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  function commit(next: string[]) {
    typed.current = next;
    setDigits(next);
  }

  function fill(start: number, chars: string[]) {
    const next = [...typed.current];
    chars.forEach((c, i) => {
      if (start + i < LENGTH) next[start + i] = c;
    });
    commit(next);
    const empty = next.findIndex((d) => d === "");
    if (empty === -1) {
      refs.current[LENGTH - 1]?.blur();
      onComplete(next.join(""));
    } else refs.current[Math.min(start + chars.length, empty)]?.focus();
  }

  function onPaste(e: ClipboardEvent<HTMLInputElement>, i: number) {
    const chars = e.clipboardData.getData("text").replace(/\D/g, "").split("");
    if (chars.length === 0) return;
    e.preventDefault();
    fill(chars.length >= LENGTH ? 0 : i, chars.slice(0, LENGTH));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>, i: number) {
    if (e.key === "Backspace" && typed.current[i] === "" && i > 0) {
      e.preventDefault();
      const next = [...typed.current];
      next[i - 1] = "";
      commit(next);
      refs.current[i - 1]?.focus();
    }
  }

  return (
    <div
      role="group"
      aria-label="Код из письма"
      className="grid grid-cols-6 gap-2"
    >
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={d}
          autoFocus={i === 0}
          disabled={disabled}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Цифра ${i + 1}`}
          aria-invalid={invalid}
          onKeyDown={(e) => onKeyDown(e, i)}
          onPaste={(e) => onPaste(e, i)}
          onChange={(e) => {
            // One digit from a keystroke, or several at once from autofill of the code
            // (one-time-code) or a fast input method: spread them over the cells.
            const chars = e.target.value
              .replace(/\D/g, "")
              .split("")
              .filter(
                (_, k, all) => all.length === 1 || k >= (d === "" ? 0 : 1),
              );
            if (chars.length === 0) {
              const next = [...typed.current];
              next[i] = "";
              commit(next);
            } else fill(i, chars.slice(0, LENGTH - i));
          }}
          className="font-prose h-14 w-full rounded-xl border border-input bg-paper text-center text-[26px] outline-none focus:border-ring focus:ring-3 focus:ring-ring/30 disabled:opacity-60 aria-invalid:border-destructive"
        />
      ))}
    </div>
  );
}
