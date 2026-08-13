export default function PrincipleItem({
  title,
  children,
  accent = "signal",
}: {
  title: string;
  children: React.ReactNode;
  accent?: "signal" | "danger";
}) {
  return (
    <li className="border-t border-line pt-5 first:border-t-0 first:pt-0">
      <h3 className={`font-display font-semibold text-base mb-1.5 ${accent === "danger" ? "text-danger" : "text-text"}`}>
        {title}
      </h3>
      <p className="text-muted leading-relaxed">{children}</p>
    </li>
  );
}
