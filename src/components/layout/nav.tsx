import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Search, Settings, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type NavItem =
  | { to: "/"; label: string }
  | { to: "/browse/$type"; params: { type: string }; label: string }
  | { to: "/collections"; label: string }
  | { to: "/list"; label: string }
  | { to: "/addons"; label: string };

const LINKS: NavItem[] = [
  { to: "/", label: "Home" },
  { to: "/browse/$type", params: { type: "series" }, label: "TV Shows" },
  { to: "/browse/$type", params: { type: "movie" }, label: "Movies" },
  { to: "/collections", label: "Collections" },
  { to: "/list", label: "My List" },
  { to: "/addons", label: "Add-ons" },
];

export function Nav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const [solid, setSolid] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function goSearch() {
    setOpen(false);
    if (pathname === "/search") {
      const field = document.querySelector<HTMLInputElement>("#app-search");
      field?.focus();
      field?.select();
      return;
    }
    void navigate({ to: "/search", search: { q: "" } });
  }

  return (
    <>
      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 pt-[env(safe-area-inset-top)] transition-[background-color,backdrop-filter] duration-300",
          solid || open || pathname === "/search" || pathname === "/options" || pathname.startsWith("/collections")
            ? "bg-bg/85 backdrop-blur-md"
            : "bg-linear-to-b from-bg/80 to-transparent",
        )}
      >
        <div className="relative z-50 flex h-16 items-center gap-3 px-4 sm:h-[68px] sm:gap-4 sm:px-8 lg:px-12">
          <Link to="/" className="shrink-0 font-display text-[2rem] leading-none tracking-wide text-accent">
            NOX
          </Link>

          <nav className="hidden items-center gap-5 md:flex">
            {LINKS.map((link) => (
              <NavLink key={link.label} item={link} active={isActive(pathname, link)} />
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon-sm"
              className="bg-transparent hover:bg-fg/10"
              aria-label="Search"
              onClick={goSearch}
            >
              <Search className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="bg-transparent hover:bg-fg/10"
              aria-label="Options"
              onClick={() => {
                setOpen(false);
                void navigate({ to: "/options" });
              }}
            >
              <Settings className="size-5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="bg-transparent hover:bg-fg/10 md:hidden"
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X className="size-5" /> : <Menu className="size-5" />}
            </Button>
          </div>
        </div>
      </header>

      {open ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-bg/80"
            aria-label="Dismiss menu"
            onClick={() => setOpen(false)}
          />
          <nav className="absolute inset-x-0 top-[calc(env(safe-area-inset-top)+4rem)] bottom-0 overflow-y-auto bg-bg px-4 py-4">
            {LINKS.map((link) => (
              <MobileLink key={link.label} item={link} active={isActive(pathname, link)} onClick={() => setOpen(false)} />
            ))}
            <button
              type="button"
              className="mt-2 flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-base text-muted touch-manipulation"
              onClick={goSearch}
            >
              <Search className="size-5" />
              Search
            </button>
            <Link
              to="/options"
              onClick={() => setOpen(false)}
              className={cn(
                "mt-1 flex w-full items-center gap-3 rounded-md px-3 py-3 text-left text-base touch-manipulation",
                pathname === "/options" ? "bg-elevated text-fg" : "text-muted",
              )}
            >
              <Settings className="size-5" />
              Options
            </Link>
          </nav>
        </div>
      ) : null}
    </>
  );
}

function isActive(pathname: string, link: NavItem) {
  if (link.to === "/") return pathname === "/";
  if (link.to === "/browse/$type" && "params" in link && link.params) {
    return pathname === `/browse/${link.params.type}`;
  }
  if (link.to === "/collections") return pathname.startsWith("/collections");
  return pathname === link.to;
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  return (
    <Link
      to={item.to}
      params={"params" in item ? item.params : undefined}
      className={cn(
        "relative text-sm transition-colors duration-150",
        active ? "font-semibold text-fg after:absolute after:inset-x-0 after:-bottom-1 after:h-px after:bg-fg" : "text-muted hover:text-fg",
      )}
    >
      {item.label}
    </Link>
  );
}

function MobileLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      to={item.to}
      params={"params" in item ? item.params : undefined}
      onClick={onClick}
      className={cn(
        "block rounded-md px-3 py-3 text-base touch-manipulation",
        active ? "bg-elevated text-fg" : "text-muted",
      )}
    >
      {item.label}
    </Link>
  );
}
