"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, notifySession } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";

export default function RegisterPage() {
  const t = useTranslations();
  const [password, setPassword] = useState("");
  const [preferred, setPreferred] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.register(password, preferred || undefined);
      // The backend sets the HttpOnly td_token cookie on registration;
      // notify the in-memory session state so the navbar flips immediately.
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
      <h1 className="font-display text-2xl font-semibold mb-1">{t("auth.anonNameTitle")}</h1>
      <p className="text-muted text-sm mb-6">{t("auth.anonNameSub")}</p>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div>
          <label htmlFor="register-preferred" className="text-sm text-muted block mb-1">
            {t("auth.preferredName")}
          </label>
          <input
            id="register-preferred"
            value={preferred}
            onChange={(e) => setPreferred(e.target.value)}
            placeholder={t("auth.preferredPlaceholder")}
            className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        <div>
          <label htmlFor="register-password" className="text-sm text-muted block mb-1">
            {t("auth.password")}
          </label>
          <input
            id="register-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-surface2 border border-line px-3 py-2 text-sm outline-none focus:border-signal"
          />
        </div>
        {error && <p className="text-danger text-sm">{error}</p>}
        <Button type="submit" disabled={loading} className="w-full">
          {loading ? t("ui.creating") : t("auth.createAccount")}
        </Button>
      </form>
    </div>
  );
}
