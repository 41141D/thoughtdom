"use client";
import { useLocale, useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { useEffect, useRef, useState } from "react";
import { api, getSession, notifySession, onSessionChange } from "../lib/api";
import Avatar from "./profile/Avatar";
import { NavButton } from "./ui/Button";

export default function NavBar() {
  const t = useTranslations();
  const locale = useLocale();
  const pathname = usePathname();
  // Full-viewport futuristic chrome: the About page (dark neon) forces the
  // nav chrome to match it while on /about, then returns to normal.
  const onAbout = pathname === "/about";
  const [username, setUsername] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Session state: bootstrapped from the authoritative server check
  // (`/auth/me` reads the HttpOnly cookie), then kept in sync by the in-memory
  // session event bus -- login, explicit logout, and server-side 401 events
  // all flip the navbar immediately with NO page reload.
  useEffect(() => {
    getSession()
      .then((name) => {
        if (name) notifySession({ type: "login", username: name });
        else notifySession({ type: "logout" });
      })
      .catch(() => notifySession({ type: "logout" }));
  }, []);

  useEffect(() => {
    return onSessionChange((event) => {
      if (event.type === "login") setUsername(event.username);
      else setUsername(null);
    });
  }, []);

  // Close both menus when clicking outside.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (userMenuOpen && userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
      if (menuOpen && menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [userMenuOpen, menuOpen]);

  // Close menus on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setUserMenuOpen(false);
        setMenuOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const signOut = async () => {
    setUserMenuOpen(false);
    setMenuOpen(false);
    try {
      await api.logout();
      // Backend logout succeeded -- flip the UI immediately (no reload).
      notifySession({ type: "logout" });
    } catch {
      // Logout failed (network or server error) -- keep the authenticated UI
      // state; the session is still valid until a successful logout.
      return;
    }
  };

  const go = (href: string) => {
    setUserMenuOpen(false);
    setMenuOpen(false);
    window.location.href = href;
  };

  // Search box state -- an uncontrolled draft that only navigates once the
  // user commits (Enter or the magnifier). Kept local here so typing never
  // re-renders the whole nav.
  const [searchDraft, setSearchDraft] = useState("");

  const runSearch = () => {
    const q = searchDraft.trim();
    if (!q) return;
    setSearchDraft("");
    go(`/search?q=${encodeURIComponent(q)}`);
  };

  return (
    <header className={`sticky top-0 z-20 border-b border-line bg-paper/95 backdrop-blur transition-colors duration-500 ${onAbout ? "about-nav" : ""}`}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-2">
        {/* Brand */}
        <Link
          href="/"
          className="font-display font-semibold text-lg tracking-tight text-text shrink-0"
        >
          Thought<span className="text-signal">Dom</span>
        </Link>

        {/* Desktop: brand on the left, everything else flows to the right edge. */}
        <div className="flex-1" />
        <nav className="hidden md:flex items-center gap-1 text-sm">
          <Link
            href="/why"
            className="px-2.5 py-2 rounded-md text-muted hover:text-text hover:bg-surface2 transition-colors"
          >
            {t("nav.why")}
          </Link>
          <Link
            href="/communities"
            className="px-2.5 py-2 rounded-md text-muted hover:text-text hover:bg-surface2 transition-colors"
          >
            {t("nav.communities")}
          </Link>
          <Link
            href="/about"
            className="px-2.5 py-2 rounded-md text-muted hover:text-text hover:bg-surface2 transition-colors"
          >
            {t("nav.about")}
          </Link>
        </nav>

        {/* Desktop search -- centered between brand and actions. */}
        <div className="flex-1 shrink-0 hidden md:block max-w-sm mx-auto px-2" style={{ minWidth: "14rem", marginInline: "0.75rem" }}>
          <SearchInput
            value={searchDraft}
            onChange={setSearchDraft}
            onSubmit={runSearch}
          />
        </div>

        {/* Desktop right column */}
        <div className="hidden md:flex items-center gap-1.5">
          {username ? (
            <>
              <Link
                href="/create"
                className="h-8 px-3 text-[13px] font-medium rounded-md bg-signal text-white hover:bg-signalHover active:bg-[#12323a] transition-colors whitespace-nowrap"
              >
                {t("post.newPost")}
              </Link>
              <Link
                href="/settings"
                aria-label={t("nav.settings")}
                title={t("nav.settings")}
                className="p-2 rounded-md text-muted hover:text-text hover:bg-surface2 transition-colors"
              >
                ⚙
              </Link>
              <UserMenu username={username} open={userMenuOpen} onToggle={setUserMenuOpen} refEl={userMenuRef} />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="px-2.5 py-2 rounded-md text-muted hover:text-text hover:bg-surface2 transition-colors text-sm"
              >
                {t("nav.signIn")}
              </Link>
              <Link
                href="/register"
                className="h-8 px-3 text-[13px] font-medium rounded-md bg-signal text-white hover:bg-signalHover active:bg-[#12323a] transition-colors whitespace-nowrap"
              >
                {t("nav.getName")}
              </Link>
            </>
          )}
        </div>

        {/* Mobile: brand left, sign-in action + search + hamburger right */}
        <div className="flex md:hidden items-center gap-1.5">
          {username ? (
            <Link
              href="/create"
              className="h-8 px-3 text-[13px] font-medium rounded-md bg-signal text-white active:bg-signalHover transition-colors whitespace-nowrap"
            >
              {t("post.newPost")}
            </Link>
          ) : (
            <Link
              href="/register"
              className="h-8 px-3 text-[13px] font-medium rounded-md bg-signal text-white active:bg-signalHover transition-colors whitespace-nowrap"
            >
              {t("nav.getName")}
            </Link>
          )}
          <button
            aria-label={t("search.title")}
            onClick={() => go("/search")}
            className="p-2 rounded-md text-muted hover:text-text hover:bg-surface2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="M21 21l-4.3-4.3" />
            </svg>
          </button>
          <button
            aria-label={t("nav.menu")}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
            className="p-2 rounded-md text-text hover:bg-surface2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
          >
            {menuOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M6 18L18 6" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <nav
          ref={menuRef}
          className="md:hidden border-t border-line bg-paper px-4 py-2 flex flex-col gap-0.5 text-sm animate-fade-in-up"
        >
          <Link href="/why" className="nav-link" onClick={() => setMenuOpen(false)}>
            {t("nav.why")}
          </Link>
          <Link href="/communities" className="nav-link" onClick={() => setMenuOpen(false)}>
            {t("nav.communities")}
          </Link>
          <div className="py-1.5">
            <SearchInput
              value={searchDraft}
              onChange={setSearchDraft}
              onSubmit={runSearch}
              mobile
            />
          </div>
          {username ? (
            <>
              <Link href={`/u/${username}`} className="nav-link" onClick={() => setMenuOpen(false)}>
                {t("nav.profile")}
              </Link>
              <Link href="/settings" className="nav-link" onClick={() => setMenuOpen(false)}>
                {t("nav.settings")}
              </Link>
              <button onClick={() => go(`/u/${username}`)} className="nav-link" aria-label={t("nav.profile")}>
                <span className="flex items-center gap-2.5">
                  <Avatar seed={username} size={20} />
                  {username}
                </span>
              </button>
              <button
                onClick={signOut}
                className="nav-link text-danger"
              >
                {t("nav.signOut")}
              </button>
            </>
          ) : (
            <Link href="/login" className="nav-link" onClick={() => setMenuOpen(false)}>
              {t("nav.signIn")}
            </Link>
          )}
        </nav>
      )}
    </header>
  );
}

/* Compact search input: typing is local; submitting navigates to the
   dedicated search page with the query as a URL parameter. The magnifier
   icon submits on demand and the field stays visible on both desktop
   (centered) and in the mobile menu. */
function SearchInput({
  value,
  onChange,
  onSubmit,
  mobile,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  mobile?: boolean;
}) {
  const t = useTranslations();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="relative flex items-center gap-0 w-full"
    >
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={mobile ? t("search.placeholderMobile") : t("search.placeholder")}
        aria-label={t("search.title")}
        autoComplete="off"
        className={`w-full rounded-md bg-surface2 border border-line px-3 py-1.5 ps-2.5 text-sm text-text placeholder:text-muted/70 outline-none focus:border-signal ${
          mobile ? "pe-8" : "pe-8"
        }`}
      />
      <button
        type="submit"
        aria-label={t("search.title")}
        style={{ insetInlineEnd: "0.375rem" }}
        className="shrink-0 absolute p-1.5 rounded-md text-muted hover:text-signal transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" aria-hidden>
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.3-4.3" />
        </svg>
      </button>
    </form>
  );
}

/* User menu: dropdown attached to the avatar + username. Profile, Settings,
   Sign Out live here. Sign Out is styled as a destructive action with a
   thin red border/text -- never neon. */
function UserMenu({
  username,
  open,
  onToggle,
  refEl,
}: {
  username: string;
  open: boolean;
  onToggle: (v: boolean) => void;
  refEl: { current: HTMLDivElement | null };
}) {
  const t = useTranslations();
  const locale = useLocale();
  const dir = locale === "ar" || locale === "ku" ? "rtl" : "ltr";

  return (
    <div ref={refEl} className="relative">
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={t("nav.userMenu")}
        onClick={() => onToggle(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-surface2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
      >
        <Avatar seed={username} size={26} />
        <span className="max-w-[140px] truncate text-sm text-text font-medium">
          {username}
        </span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={`text-muted transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div
          dir={dir}
          className={`absolute mt-1.5 w-52 rounded-lg border border-line bg-surface shadow-lg py-1 z-30 ${
            dir === "rtl" ? "start-auto end-0" : "start-0 end-auto"
          }`}
          role="menu"
        >
          <div className="px-3 py-2 border-b border-line">
            <p className="text-sm font-medium text-text truncate">{username}</p>
            <p className="text-xs text-muted">{t("profile.joinedNote")}</p>
          </div>
          <Link
            href={`/u/${username}`}
            role="menuitem"
            onClick={() => onToggle(false)}
            className="menu-item"
          >
            {t("nav.profile")}
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => onToggle(false)}
            className="menu-item"
          >
            {t("nav.settings")}
          </Link>
          <button
            role="menuitem"
            onClick={async () => {
              onToggle(false);
              try {
                await api.logout();
                notifySession({ type: "logout" });
              } catch {
                // Logout failed -- keep the authenticated UI state.
                return;
              }
            }}
            className="w-full text-start px-3 py-2 text-sm text-danger hover:bg-danger/10 transition-colors border-t border-line mt-1"
          >
            {t("nav.signOut")}
          </button>
        </div>
      )}
    </div>
  );
}
