/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        /* Design tokens v2 (see app/globals.css for the light/dark mappings).
           Names describe ROLE, not color: bg-ink/surface/paper etc. map to
           clearly distinguishable values in each theme so the hierarchy is
           visible at a glance without brightening everything. */
        ink: "var(--td-ink)",            // deepest surface -- page background in dark
        surface: "var(--td-surface)",    // cards
        surface2: "var(--td-surface2)",  // elevated surfaces, inputs, hover
        line: "var(--td-line)",          // borders -- subtle but visible
        text: "var(--td-text)",          // primary text
        muted: "var(--td-muted)",        // secondary text -- readable, not invisible
        paper: "var(--td-paper)",        // page background in light
        signal: "#1f5564",               // primary accent: ink-teal (kept, slightly deepened)
        signalHover: "#17404b",
        agree: "#3e7058",                // agree reply type (sage)
        challenge: "#c28b46",            // challenge reply type (amber, more visible)
        danger: "#a94040",               // destructive actions
        dangerHover: "#8f3434",
      },
      fontFamily: {
        display: ["'Source Serif 4'", "Georgia", "serif"],
        body: ["'Inter'", "sans-serif"],
      },
      borderRadius: {
        sm: "0.25rem",
        md: "0.375rem",
        lg: "0.5rem",
        xl: "0.625rem",
        full: "9999px", // only avatars and toggle handles
      },
    },
  },
  plugins: [],
};
