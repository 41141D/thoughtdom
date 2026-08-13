import type { Metadata } from "next";
import { getTranslations, unstable_setRequestLocale } from "next-intl/server";
import Reveal from "../../../components/why/Reveal";
import PrincipleItem from "../../../components/why/PrincipleItem";

type Principle = { principle: string; description: string };
type NeverBecomeItem = { title: string; description: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "why.meta" });

  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function WhyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  unstable_setRequestLocale(locale);

  const t = await getTranslations("why");

  const existenceParagraphs = t.raw("existence.paragraphs") as string[];
  const principles = t.raw("beliefs.principles") as Principle[];
  const steelManParagraphs = t.raw("steelManGate.paragraphs") as string[];
  const neverBecomeItems = t.raw("neverBecome.items") as NeverBecomeItem[];
  const visionParagraphs = t.raw("vision.paragraphs") as string[];
  const closingParagraph = visionParagraphs[visionParagraphs.length - 1];

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
        <Reveal delay={120}>
          <p className="mt-8 font-display text-text/90 text-base max-w-lg mx-auto leading-relaxed italic">
            {t("hero.quote")}
          </p>
        </Reveal>
      </header>

      {/* ---------- Why ThoughtDom Exists ---------- */}
      <section aria-labelledby="why-heading" className="pt-16 sm:pt-20">
        <Reveal>
          <h2 id="why-heading" className="font-display text-2xl font-semibold mb-6">
            {t("existence.title")}
          </h2>
          <div className="space-y-4 text-text/85 leading-relaxed">
            {existenceParagraphs.map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- What We Believe ---------- */}
      <section aria-labelledby="believe-heading" className="pt-16 sm:pt-20">
        <Reveal>
          <h2 id="believe-heading" className="font-display text-2xl font-semibold mb-6">
            {t("beliefs.title")}
          </h2>
        </Reveal>
        <Reveal delay={80}>
          <ul className="space-y-5">
            {principles.map((item, i) => (
              <PrincipleItem key={i} title={item.principle}>
                {item.description}
              </PrincipleItem>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ---------- The Steel-Man Gate ---------- */}
      <section aria-labelledby="gate-heading" className="pt-16 sm:pt-20">
        <Reveal>
          <h2 id="gate-heading" className="font-display text-2xl font-semibold mb-6">
            {t("steelManGate.title")}
          </h2>
          <div className="space-y-4 text-text/85 leading-relaxed">
            {steelManParagraphs.map((paragraph, i) => (
              <p
                key={i}
                className={i === steelManParagraphs.length - 1 ? "steelman-mirror text-text/90" : undefined}
              >
                {paragraph}
              </p>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- What ThoughtDom Will Never Become ---------- */}
      <section aria-labelledby="never-heading" className="pt-16 sm:pt-20">
        <Reveal>
          <h2 id="never-heading" className="font-display text-2xl font-semibold mb-3">
            {t("neverBecome.title")}
          </h2>
          <p className="text-muted leading-relaxed mb-6">{t("neverBecome.intro")}</p>
        </Reveal>
        <Reveal delay={80}>
          <ul className="space-y-5">
            {neverBecomeItems.map((item, i) => (
              <PrincipleItem key={i} title={item.title} accent="danger">
                {item.description}
              </PrincipleItem>
            ))}
          </ul>
        </Reveal>
      </section>

      {/* ---------- Our Vision ---------- */}
      <section aria-labelledby="vision-heading" className="pt-16 sm:pt-20">
        <Reveal>
          <h2 id="vision-heading" className="font-display text-2xl font-semibold mb-6">
            {t("vision.title")}
          </h2>
          <div className="space-y-4 text-text/85 leading-relaxed">
            {visionParagraphs.slice(0, -1).map((paragraph, i) => (
              <p key={i}>{paragraph}</p>
            ))}
          </div>
        </Reveal>
      </section>

      {/* ---------- Closing ---------- */}
      <footer className="pt-16 sm:pt-20 pb-4 text-center">
        <Reveal>
          <div className="h-px w-16 bg-line mx-auto mb-10" aria-hidden="true" />
          <p className="font-display text-xl sm:text-2xl font-semibold leading-snug max-w-lg mx-auto text-text">
            {closingParagraph}
          </p>
        </Reveal>
      </footer>
    </article>
  );
}
