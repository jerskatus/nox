function visible(el: HTMLElement) {
  if (el.closest("[data-player]")) return false;
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.pointerEvents === "none") return false;
  const rect = el.getBoundingClientRect();
  return rect.width >= 8 && rect.height >= 8 && rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
}

function targets() {
  return [...document.querySelectorAll<HTMLElement>("a[href], button:not(:disabled), [data-tv], [tabindex]:not([tabindex='-1'])")].filter(
    (el) => visible(el) && !el.closest("[aria-hidden='true']"),
  );
}

function center(el: HTMLElement) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, r };
}

function overlap(a: DOMRect, b: DOMRect, axis: "x" | "y") {
  if (axis === "x") return Math.min(a.right, b.right) - Math.max(a.left, b.left);
  return Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
}

function pick(dir: "up" | "down" | "left" | "right", current: HTMLElement | null) {
  const list = targets();
  if (list.length === 0) return null;
  if (!current || !list.includes(current)) return list[0] ?? null;
  const from = center(current);
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === current) continue;
    const to = center(el);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const overlapAmt = overlap(from.r, to.r, dir === "left" || dir === "right" ? "y" : "x");
    let aligned = overlapAmt > 8;
    let dist = 0;
    if (dir === "right" && dx > 8) dist = dx + (aligned ? 0 : Math.abs(dy) * 2);
    else if (dir === "left" && dx < -8) dist = -dx + (aligned ? 0 : Math.abs(dy) * 2);
    else if (dir === "down" && dy > 8) dist = dy + (aligned ? 0 : Math.abs(dx) * 2);
    else if (dir === "up" && dy < -8) dist = -dy + (aligned ? 0 : Math.abs(dx) * 2);
    else continue;
    if (dist < bestScore) {
      bestScore = dist;
      best = el;
    }
  }
  return best;
}

export function startTvRemote() {
  document.documentElement.dataset.tv = "on";
  const idle = () => {
    document.documentElement.dataset.tvCursor = "hidden";
  };
  let timer = window.setTimeout(idle, 1800);
  const onMove = () => {
    document.documentElement.dataset.tvCursor = "show";
    window.clearTimeout(timer);
    timer = window.setTimeout(idle, 1800);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const tag = (event.target as HTMLElement | null)?.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (document.querySelector("[data-player]")) return;
    const map: Record<string, "up" | "down" | "left" | "right"> = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const dir = map[event.key];
    if (dir) {
      event.preventDefault();
      const next = pick(dir, document.activeElement instanceof HTMLElement ? document.activeElement : null);
      next?.focus();
      return;
    }
    if (event.key === "Backspace" || event.key === "BrowserBack") {
      event.preventDefault();
      window.history.back();
    }
  };
  window.addEventListener("mousemove", onMove, { passive: true });
  window.addEventListener("keydown", onKey);
  const first = targets()[0];
  first?.focus();
  return () => {
    window.clearTimeout(timer);
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("keydown", onKey);
    delete document.documentElement.dataset.tv;
    delete document.documentElement.dataset.tvCursor;
  };
}
