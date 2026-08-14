"use client";
import { useTranslations } from "next-intl";

/**
 * Wire native (translated) validation messages to a form input so that the
 * "X is required" browser tooltip is localized instead of English.
 * Usage inside a page component:
 *   const valid = useFieldValidation();
 *   <input ... {...valid("validation.usernameRequired")} />
 *
 * The input keeps the native `required`/`minLength` attributes (HTML5
 * validation); we only translate the message text. No JWT, no storage,
 * no state beyond React's own.
 */
export function useFieldValidation() {
  const t = useTranslations();
  return (key: string) => ({
    onInvalid: (e: React.InvalidEvent<HTMLInputElement>) => {
      const input = e.currentTarget;
      const message = t(key) || key;
      if (input.validity.valueMissing) {
        input.setCustomValidity(message);
      } else if (input.validity.tooShort) {
        input.setCustomValidity(t("validation.passwordMin"));
      } else {
        input.setCustomValidity("");
      }
    },
    onInput: (e: React.FormEvent<HTMLInputElement>) => {
      e.currentTarget.setCustomValidity("");
    },
  });
}

/** Convenience hook for the steel-man textarea in ReplyForm. */
export function useSteelmanValidation() {
  const t = useTranslations();
  return {
    onInvalid: (e: React.InvalidEvent<HTMLTextAreaElement>) => {
      const el = e.currentTarget;
      el.setCustomValidity(
        el.validity.valueMissing ? t("validation.steelmanRequired") : ""
      );
    },
    onInput: (e: React.FormEvent<HTMLTextAreaElement>) => {
      e.currentTarget.setCustomValidity("");
    },
  };
}
