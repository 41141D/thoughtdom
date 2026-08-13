"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { useCallback, useEffect, useState } from "react";
import { api, getSession, notifySession, onSessionChange } from "../../../lib/api";
import { ThemePreference, useTheme } from "../../../lib/theme";
import { Button } from "../../../components/ui/Button";

const LOCALES = [
  { code: "en", nativeName: "English", latinName: "English" },
  { code: "ku", nativeName: "کوردی", latinName: "Kurdish (Sorani)" },
  { code: "ar", nativeName: "العربية", latinName: "Arabic" },
] as const;

function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function ScreenIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M8 20h8M12 17v3" />
      <path d="M12 4v7" strokeLinejoin="round" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

const THEME_OPTIONS: { value: ThemePreference; icon: React.ReactNode; labelKey: string }[] = [
  { value: "light", icon: <SunIcon />, labelKey: "theme.light" },
  { value: "dark", icon: <MoonIcon />, labelKey: "theme.dark" },
  { value: "system", icon: <ScreenIcon />, labelKey: "theme.system" },
];

export default function SettingsPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { theme, setTheme } = useTheme();

  const [username, setUsername] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  // Server can't read localStorage, so preference-bound indicators must stay
  // in the deterministic "inactive" state until the client has hydrated; this
  // keeps server and client HTML byte-identical (no hydration warnings).
  const [hydrated, setHydrated] = useState(false);

  // Session state: authoritative server check (/auth/me reads the HttpOnly
  // cookie), then kept in sync by the in-memory session event bus so login
  // and logout reflect immediately without a page reload.
  useEffect(() => {
    getSession()
      .then((name) => {
        if (name) notifySession({ type: "login", username: name });
        else notifySession({ type: "logout" });
      })
      .catch(() => notifySession({ type: "logout" }));
    setHydrated(true);
  }, []);

  useEffect(() => {
    return onSessionChange((event) => {
      if (event.type === "login") {
        setUsername(event.username);
        setSignedOut(false);
      }
      else {
        setUsername(null);
        setSignedOut(true);
        setTimeout(() => router.push("/"), 700);
      }
    });
  }, [router]);

  const changeLocale = useCallback(
    (code: (typeof LOCALES)[number]["code"]) => {
      router.push("/settings", { locale: code });
    },
    [router]
  );

  const signOut = async () => {
    try {
      await api.logout();
      // Backend logout succeeded -- the NavBar (same event bus) and this page
      // flip to logged-out state immediately; no reload required.
      notifySession({ type: "logout" });
    } catch {
      // Logout failed (network or server error) -- keep the authenticated UI
      // state; the session remains valid until a successful logout.
    }
  };

  return (
    <div className="animate-fade-in-up flex flex-col gap-6 max-w-2xl">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-semibold text-text">
          {t("settings.title")}
        </h1>
        <p className="text-sm text-muted">{t("settings.subtitle")}</p>
      </header>

      {/* Appearance */}
      <Section title={t("settings.appearance")} icon={<SunIcon />}>
        <p className="text-sm text-muted mb-4 leading-relaxed">
          {t("settings.appearanceHint")}
        </p>
        <div className="grid grid-cols-3 gap-2">
          {THEME_OPTIONS.map((opt) => {
            const active = hydrated && theme === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                aria-pressed={active}
                className={`rounded-lg border p-4 flex flex-col items-center gap-2.5 transition-colors ${
                  active
                    ? "border-signal bg-signal/10 text-signal shadow-[inset_0_0_0_1px_var(--td-signal)]"
                    : "border-line bg-surface2 text-muted hover:text-text"
                }`}
              >
                {/* Until hydration resolves the saved theme the check and the
                    theme icon stack in the same place with deterministic
                    opacity; nothing mismatches server HTML. */}
                <span className="relative h-5 w-5">
                  <span
                    aria-hidden
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${active ? "" : "opacity-0"}`}
                  >
                    <CheckIcon />
                  </span>
                  <span
                    aria-hidden
                    className={`absolute inset-0 flex items-center justify-center transition-opacity duration-150 ${active ? "opacity-0" : ""}`}
                  >
                    {opt.icon}
                  </span>
                </span>
                <span className="text-xs font-medium">{t(opt.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Language */}
      <Section title={t("settings.language")} icon={<GlobeIcon />}>
        <p className="text-sm text-muted mb-4 leading-relaxed">
          {t("settings.languageHint")}
        </p>
        <div className="flex flex-col gap-2">
          {LOCALES.map((l) => {
            const active = hydrated && l.code === locale;
            return (
              <button
                key={l.code}
                onClick={() => changeLocale(l.code)}
                aria-pressed={active}
                className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-3 transition-colors ${
                  active
                    ? "border-signal bg-signal/10 text-signal shadow-[inset_0_0_0_1px_var(--td-signal)]"
                    : "border-line bg-surface2 text-text hover:border-signal/50"
                }`}
              >
                <span className="font-display text-base">{l.nativeName}</span>
                {/* Same deterministic-until-hydration approach as the theme
                    buttons: server and pre-hydration client render identical
                    markup, so no hydration warning fires. */}
                <span>
                  <span
                    className={`text-xs font-semibold transition-opacity duration-150 ${active ? "" : "opacity-0"}`}
                    aria-hidden={active ? undefined : true}
                  >
                    {l.latinName} · {t("settings.active")}
                  </span>
                  <span
                    className={`text-xs text-muted transition-opacity duration-150 ${active ? "opacity-0" : ""}`}
                    aria-hidden={active ? true : undefined}
                  >
                    {l.latinName}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Section>

      {/* Account */}
      <Section title={t("settings.account")} icon={<PersonIcon />}>
        {signedOut ? (
          <p className="text-sm text-muted">{t("settings.signedOut")}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <p className="text-sm text-text font-medium">
                  {username ?? t("settings.notSignedIn")}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {t("settings.identityHint")}
                </p>
              </div>
              {username && (
                <a
                  href={`/${locale}/u/${username}`}
                  className="text-xs text-signal font-medium hover:underline"
                >
                  {t("settings.viewProfile")}
                </a>
              )}
            </div>
            <Button variant="destructive" onClick={signOut} disabled={signedOut}>
              {t("nav.signOut")}
            </Button>
          </>
        )}
      </Section>

      <footer className="text-xs text-muted text-center pb-6">
        {t("settings.footer")}
      </footer>
    </div>
  );
}

function GlobeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.4 2.7 3.7 5.9 3.7 9s-1.3 6.3-3.7 9c-2.4-2.7-3.7-5.9-3.7-9s1.3-6.3 3.7-9z" />
    </svg>
  );
}

function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </svg>
  );
}

function Section({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-line bg-surface p-6">
      <h2 className="font-display text-sm font-semibold text-muted uppercase tracking-wide mb-4 flex items-center gap-2">
        <span className="text-signal" aria-hidden>
          {icon}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}
