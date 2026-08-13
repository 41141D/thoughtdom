"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, notifySession } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";

export default function LoginPage() {
  const t = useTranslations();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.login(username, password);
      // The backend sets the HttpOnly td_token cookie on login; notify the
      // in-memory session state so the navbar flips to logged-in immediately.
      notifySession({ type: "login", username: res.username });
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto mt-8">
      <h1 className="font-display text-2xl font-semibold mb-6">{t("auth.signIn")}</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="login-username" className="text-sm text-muted block mb-1">
            {t("auth.username")}
          </label>
          <input
            id="login-username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        <div>
          <label htmlFor="login-password" className="text-sm text-muted block mb-1">
            {t("auth.password")}
          </label>
          <input
            id="login-password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t("auth.signingIn") : t("auth.signIn")}
        </Button>
      </form>
    </div>
  );
}
