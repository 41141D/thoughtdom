import type { Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import Reveal from "../../../components/why/Reveal";

type Member = { name: string; role: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about.meta" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);
  const t = await getTranslations("about");
  const members = t.raw("team.members") as Member[];
  const introParagraphs = t.raw("intro.paragraphs") as string[];
  const socialLinks = t.raw("social.links") as { label: string; href: string }[];

  return (
    <article className="pb-8">
      {/* ---------- Hero ---------- */}
      <header className="rounded-lg -mx-4 px-4 pt-14 pb-12 sm:pt-20 sm:pb-16 sm:mx-0 sm:px-8 text-center">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.2em] text-signal font-medium mb-5">
            {t("title")}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight text-text max-w-xl mx-auto">
            {t("hero.heading")}
          </h1>
          <p className="text-muted text-lg mt-4 max-w-md mx-auto leading-relaxed">
            {t("hero.subheading")}
          </p>
        </Reveal>
      </header>

      {/* ---------- Who We Are ---------- */}
      <section aria-labelledby="about-heading" className="pt-16 sm:pt-20">
        <Reveal>
          <h2 id="about-heading" className="font-display text-2xl font-semibold mb-6">
            {t("intro.title")}
          </h2>
          <div className="space-y-4 text-text/85 leading-relaxed">
            {introParagraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- The Team ---------- */}
      <section aria-labelledby="team-heading" className="pt-16 sm:pt-20">
        <Reveal>
          <h2 id="team-heading" className="font-display text-2xl font-semibold mb-6">
            {t("team.title")}
          </h2>
        </Reveal>
        <ul className="grid gap-4 sm:grid-cols-3 mt-6">
          {members.map((member, i) => (
            <Reveal key={i} delay={i * 80}>
              <li className="rounded-lg border border-line bg-surface p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-signal/15 text-signal font-display text-lg font-semibold flex items-center justify-center mx-auto mb-4">
                  {member.name.charAt(0)}
                </div>
                <p className="font-display text-lg font-semibold text-text">
                  {member.name}
                </p>
                <p className="text-muted text-sm mt-1">{member.role}</p>
              </li>
            </Reveal>
          ))}
        </ul>
      </section>

      {/* ---------- Follow Us ---------- */}
      <section aria-labelledby="social-heading" className="pt-16 sm:pt-20">
        <Reveal>
          <h2 id="social-heading" className="font-display text-2xl font-semibold mb-6">
            {t("social.title")}
          </h2>
          <div className="flex flex-wrap gap-3">
            {socialLinks.map((link, i) => (
              <a
                key={i}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-md border border-line bg-surface px-4 py-2.5 text-sm font-medium text-text hover:bg-surface2 hover:border-signal/50 transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- Closing ---------- */}
      <footer className="pt-16 sm:pt-20 pb-4 text-center">
        <Reveal>
          <div className="h-px w-16 bg-line mx-auto mb-10" aria-hidden="true" />
          <p className="font-display text-xl sm:text-2xl font-semibold leading-snug max-w-lg mx-auto text-text">
            {t("closing")}
          </p>
        </Reveal>
      </footer>
    </article>
  );
}
