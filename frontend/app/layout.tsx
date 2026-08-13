// Root layout is intentionally minimal: Next.js requires one at app/layout.tsx,
// but the actual <html>/<body> document and providers live in
// app/[locale]/layout.tsx, since everything under app/ is now locale-scoped.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
