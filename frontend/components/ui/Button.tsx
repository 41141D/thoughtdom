import { ButtonHTMLAttributes, ReactNode } from "react";

/* Shared button design system.
   Tokens come from app/globals.css (design tokens v2) via the Tailwind color
   map. Consistent height (h-10) and padding across variants; visible hover,
   focus, and disabled states; no gradients, no glass, editorial restraint. */

type Variant = "primary" | "secondary" | "destructive" | "ghost" | "icon";
type Size = "md" | "sm";

const base =
  "inline-flex items-center justify-center gap-2 font-medium select-none " +
  "transition-colors duration-150 rounded-md whitespace-nowrap " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal " +
  "disabled:opacity-50 disabled:pointer-events-none";

const sizes: Record<Size, string> = {
  md: "h-10 px-4 text-sm",
  sm: "h-8 px-3 text-xs",
};

const variants: Record<Variant, string> = {
  primary:
    "bg-signal text-white hover:bg-signalHover active:bg-[#12323a] " +
    "border border-transparent",
  secondary:
    "bg-surface2 text-text border border-line hover:bg-line active:bg-[#d8d0c0] " +
    "hover:border-[#cfc7b8]",
  destructive:
    "bg-transparent text-danger border border-danger/40 hover:bg-danger/10 " +
    "hover:border-danger/70 active:bg-danger/20",
  ghost:
    "bg-transparent text-text border border-transparent hover:bg-surface2 " +
    "active:bg-line",
  icon: "bg-transparent text-text border border-transparent p-2 aspect-square " +
    "rounded-md hover:bg-surface2 active:bg-line",
};

export function Button({
  variant = "primary",
  size = "md",
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`${base} ${sizes[size]} ${variants[variant]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/* Primary-styled classes for anchor elements (same look as primary buttons)
   without button semantics -- for navigation into creation flows. */
export const primaryLink =
  base + " " + sizes.md + " " + variants.primary;

/* Link-styled button used in navbars where a button must look like a quiet
   text control but keep button semantics (hover/focus/disabled). */
export function NavButton({
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { children?: ReactNode }) {
  return (
    <button
      type="button"
      className={
        `inline-flex items-center gap-1.5 px-2.5 py-2 rounded-md text-sm font-medium ` +
        `text-muted hover:text-text hover:bg-surface2 transition-colors ` +
        `focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ` +
        `disabled:opacity-50 ${className}`
      }
      {...rest}
    >
      {children}
    </button>
  );
}
