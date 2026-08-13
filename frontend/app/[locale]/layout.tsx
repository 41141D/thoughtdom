import "../globals.css";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, unstable_setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Script from "next/script";
import NavBar from "../../components/NavBar";
import { ThemeProvider } from "../../lib/theme";
import { routing } from "../../i18n/routing";

export const metadata: Metadata = {
  title: "ThoughtDom",
  description: "Where ideas have names. People don't.",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    notFound();
  }

  // Enables static rendering for this locale segment (required by next-intl
  // whenever a Server Component reads translations/messages)
  unstable_setRequestLocale(locale);

  const messages = await getMessages();

  // Real RTL: the document direction follows the locale, so browser chrome,
  // scrollbars, and inherited margins flip without per-component hacks.
  const dir = locale === "en" ? "ltr" : "rtl";

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* Inline theme bootstrap -- dark class applied before first paint.
            next/script beforeInteractive injects it into <head> synchronously. */}
        <Script
          id="td-theme-bootstrap"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){
  try{
    var p = localStorage.getItem("td_theme");
    var dark = p === "dark" || (p !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
  }catch(e){}
})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <NextIntlClientProvider locale={locale} messages={messages}>
            <NavBar />
            <main className="max-w-2xl mx-auto px-4 pb-24 pt-6">{children}</main>
          </NextIntlClientProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
