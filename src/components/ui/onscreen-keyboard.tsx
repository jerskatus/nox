import { ArrowUp, Delete, Keyboard, X } from "lucide-react";
import { useEffect, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";

const LETTERS = [
  ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],
  ["a", "s", "d", "f", "g", "h", "j", "k", "l"],
  ["z", "x", "c", "v", "b", "n", "m"],
];

const NUMBERS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

const SYMBOLS = [
  ["!", "@", "#", "$", "%", "&", "*", "(", ")", "'"],
  ["\"", "-", "_", "=", "+", "/", ":", ";", "?"],
  [",", ".", "…"],
];

export function KeyboardToggle({
  open,
  onClick,
}: {
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={open ? "Hide on-screen keyboard" : "Show on-screen keyboard"}
      aria-pressed={open}
      title="Type with the mouse"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "absolute top-1/2 right-1.5 grid size-9 -translate-y-1/2 place-items-center rounded-sm touch-manipulation",
        open ? "bg-fg text-bg" : "text-muted hover:bg-fg/10 hover:text-fg",
      )}
    >
      <Keyboard className="size-4" />
    </button>
  );
}

export function OnscreenKeyboard({
  value,
  onChange,
  onSubmit,
  onClose,
  inputRef,
}: {
  value: string;
  onChange: (next: string) => void;
  onSubmit?: () => void;
  onClose: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const [shift, setShift] = useState(false);
  const [symbols, setSymbols] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function caret() {
    const el = inputRef?.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    return { start, end };
  }

  function place(next: string, pos: number) {
    onChange(next);
    requestAnimationFrame(() => {
      const el = inputRef?.current;
      if (!el) return;
      el.focus();
      try {
        el.setSelectionRange(pos, pos);
      } catch {
        /* type=search in some browsers */
      }
    });
  }

  function insert(text: string) {
    const { start, end } = caret();
    place(value.slice(0, start) + text + value.slice(end), start + text.length);
    if (shift && text.toLowerCase() !== text.toUpperCase()) setShift(false);
  }

  function backspace() {
    const { start, end } = caret();
    if (start !== end) {
      place(value.slice(0, start) + value.slice(end), start);
      return;
    }
    if (start === 0) return;
    place(value.slice(0, start - 1) + value.slice(end), start - 1);
  }

  const letterRows = symbols ? SYMBOLS : LETTERS;

  return (
    <>
      <div className="h-60 sm:h-64" aria-hidden />
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto max-w-4xl px-2 py-2 sm:px-3 sm:py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-xs font-medium text-muted">On-screen keyboard</p>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={onClose}
              className="inline-flex h-9 items-center gap-1.5 rounded-sm px-2 text-xs font-semibold text-muted hover:bg-elevated hover:text-fg"
            >
              <X className="size-3.5" />
              Hide
            </button>
          </div>
          <div className="flex flex-col gap-1">
            <Row>
              {NUMBERS.map((key) => (
                <Key key={key} onClick={() => insert(key)}>
                  {key}
                </Key>
              ))}
            </Row>
            {letterRows.map((row, index) => (
              <Row key={index}>
                {index === 2 && !symbols ? (
                  <Key
                    wide
                    active={shift}
                    label="Shift"
                    onClick={() => setShift((v) => !v)}
                  >
                    <ArrowUp className="size-4" />
                  </Key>
                ) : null}
                {row.map((key) => {
                  const label = !symbols && shift ? key.toUpperCase() : key;
                  return (
                    <Key key={key} onClick={() => insert(label)}>
                      {label}
                    </Key>
                  );
                })}
                {index === 2 ? (
                  <Key wide label="Backspace" onClick={backspace}>
                    <Delete className="size-4" />
                  </Key>
                ) : null}
              </Row>
            ))}
            <Row>
              <Key wide onClick={() => setSymbols((v) => !v)}>
                {symbols ? "ABC" : "?123"}
              </Key>
              <Key space label="Space" onClick={() => insert(" ")}>
                Space
              </Key>
              <Key
                wide
                onClick={() => {
                  onChange("");
                  place("", 0);
                }}
              >
                Clear
              </Key>
              <Key wide primary label="Search" onClick={() => onSubmit?.()}>
                Search
              </Key>
            </Row>
          </div>
        </div>
      </div>
    </>
  );
}

function Row({ children }: { children: ReactNode }) {
  return <div className="flex justify-center gap-1">{children}</div>;
}

function Key({
  children,
  onClick,
  wide,
  space,
  active,
  primary,
  label,
}: {
  children: ReactNode;
  onClick: () => void;
  wide?: boolean;
  space?: boolean;
  active?: boolean;
  primary?: boolean;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 min-w-0 items-center justify-center rounded-sm text-sm font-semibold select-none touch-manipulation sm:h-12",
        space ? "flex-[3] px-2" : wide ? "flex-[1.4] px-2" : "flex-1",
        primary
          ? "bg-fg text-bg hover:bg-fg/90"
          : active
            ? "bg-fg text-bg"
            : "bg-elevated text-fg hover:bg-fg/15 active:bg-fg active:text-bg",
      )}
    >
      {children}
    </button>
  );
}
