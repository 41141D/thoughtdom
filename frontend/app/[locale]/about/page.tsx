import type { Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import Reveal from "../../../components/why/Reveal";

type Member = { name: string; role: string };
type SocialLink = { label: string; href: string };

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
  const socialLinks = t.raw("social.links") as SocialLink[];

  return (
    // Force the dark, glowing presentation for this page regardless of theme.
    <div className="min-h-[60vh] about-fx relative overflow-hidden">
      {/* Grid backdrop */}
      <div className="about-grid absolute inset-0 pointer-events-none" aria-hidden="true" />
      {/* Soft radial glows */}
      <div
        className="absolute -top-32 start-1/4 w-[30rem] h-[30rem] rounded-full opacity-30 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #2aa6d6 0%, transparent 65%)" }}
        aria-hidden="true"
      />
      <div
        className="absolute top-1/2 -end-32 w-[26rem] h-[26rem] rounded-full opacity-25 blur-3xl pointer-events-none"
        style={{ background: "radial-gradient(circle, #3b6fd9 0%, transparent 65%)" }}
        aria-hidden="true"
      />

      <article className="relative pb-8">
        {/* ---------- Hero ---------- */}
        <header className="rounded-lg -mx-4 px-4 pt-16 pb-14 sm:pt-24 sm:pb-20 sm:mx-0 sm:px-8 text-center">
          <Reveal>
            <p className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-[#4fc3f7] font-medium mb-6">
              <span className="inline-block w-8 h-px bg-gradient-to-r from-transparent to-[#4fc3f7]" aria-hidden="true" />
              {t("title")}
              <span className="inline-block w-8 h-px bg-gradient-to-l from-transparent to-[#4fc3f7]" aria-hidden="true" />
            </p>
            <h1 className="font-display text-3xl sm:text-4xl font-semibold leading-tight text-text max-w-xl mx-auto">
              {t("hero.heading")}
            </h1>
            <p className="text-[#9fd8ee] text-lg mt-4 max-w-md mx-auto leading-relaxed">
              {t("hero.subheading")}
            </p>
          </Reveal>
          <Reveal delay={150}>
            <div className="about-underline w-24 h-1 mx-auto mt-10" aria-hidden="true" />
          </Reveal>
        </header>

        {/* ---------- Who We Are ---------- */}
        <section aria-labelledby="about-heading" className="pt-10 sm:pt-16">
          <Reveal>
            <h2 id="about-heading" className="font-display text-2xl font-semibold mb-6 text-[#4fc3f7]">
              {t("intro.title")}
            </h2>
            <div className="space-y-4 text-[#cfd8e0] leading-relaxed">
              {introParagraphs.map((paragraph, i) => (
                <p key={i}>{paragraph}</p>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ---------- The Team ---------- */}
        <section aria-labelledby="team-heading" className="pt-16 sm:pt-20">
          <Reveal>
            <h2 id="team-heading" className="font-display text-2xl font-semibold mb-2 text-[#4fc3f7]">
              {t("team.title")}
            </h2>
            <p className="text-[#7a8a99] text-sm mb-8 font-mono" dir="ltr">// the builders of ThoughtDom</p>
          </Reveal>
          <ul className="grid gap-5 sm:grid-cols-3">
            {members.map((member, i) => (
              <Reveal key={i} delay={i * 100}>
                <li className="about-card rounded-lg border border-[#1e4a6e]/60 bg-[#0a1620]/70 backdrop-blur p-7 text-center h-full">
                  <div className="about-avatar w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center">
                    <span className="font-display text-xl font-semibold text-[#4fc3f7]">
                      {member.name.charAt(0)}
                    </span>
                  </div>
                  <p className="font-display text-lg font-semibold text-white">
                    {member.name}
                  </p>
                  <p className="about-role text-[#4fc3f7]/90 text-xs uppercase tracking-[0.18em] mt-2">
                    {member.role}
                  </p>
                  <div className="about-scanline absolute inset-0 rounded-lg pointer-events-none" aria-hidden="true" />
                </li>
              </Reveal>
            ))}
          </ul>
        </section>

        {/* ---------- Follow Us ---------- */}
        <section aria-labelledby="social-heading" className="pt-16 sm:pt-20">
          <Reveal>
            <h2 id="social-heading" className="font-display text-2xl font-semibold mb-2 text-[#4fc3f7]">
              {t("social.title")}
            </h2>
            <p className="text-[#7a8a99] text-sm mb-8 font-mono" dir="ltr">// channels, open and free</p>
            <div className="flex flex-wrap gap-3">
              {socialLinks.map((link, i) => (
                <a
                  key={i}
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="about-link inline-flex items-center gap-2 rounded-md border border-[#1e4a6e]/70 bg-[#0a1620]/70 px-5 py-3 text-sm font-medium text-[#9fd8ee] transition-all duration-300 hover:border-[#4fc3f7] hover:text-white hover:shadow-[0_0_24px_rgba(79,195,247,0.35)]"
                >
                  <span className="about-link-dot inline-block w-2 h-2 rounded-full bg-[#4fc3f7]" aria-hidden="true" />
                  {link.label}
                </a>
              ))}
            </div>
          </Reveal>
        </section>

        {/* ---------- Closing ---------- */}
        <footer className="pt-16 sm:pt-20 pb-4 text-center">
          <Reveal>
            <div className="h-px w-16 bg-[#1e4a6e] mx-auto mb-10" aria-hidden="true" />
            <p className="font-display text-xl sm:text-2xl font-semibold leading-snug max-w-lg mx-auto text-text">
              {t("closing")}
            </p>
          </Reveal>
        </footer>
      </article>
    </div>
  );
}
