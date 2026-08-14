"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { api, notifySession } from "../../../lib/api";
import { Button } from "../../../components/ui/Button";
import { useFieldValidation } from "../../../components/FormValidation";

export default function RegisterPage() {
  const t = useTranslations();
  const valid = useFieldValidation();
  const [password, setPassword] = useState("");
  const [preferred, setPreferred] = useState("");
  const [randomIdentity, setRandomIdentity] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await api.register(password, randomIdentity ? undefined : (preferred || undefined), randomIdentity);
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
        <div className="flex items-start gap-2">
          <input
            type="checkbox"
            id="register-random"
            checked={randomIdentity}
            onChange={(e) => setRandomIdentity(e.target.checked)}
            className="mt-1 h-4 w-4 accent-signal"
          />
          <label htmlFor="register-random" className="text-sm leading-snug">
            {t("auth.randomIdentity")}
            <span className="block text-muted text-xs mt-0.5">{t("auth.randomIdentityNote")}</span>
          </label>
        </div>
        {!randomIdentity && (
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
        )}
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
            {...valid("validation.passwordRequired")}
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
