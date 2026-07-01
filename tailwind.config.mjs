/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,ts}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"]
      },
      colors: {
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        surface2: "var(--color-surface-2)",
        ink: "var(--color-ink)",
        muted: "var(--color-muted)",
        faint: "var(--color-faint)",
        rule: "var(--color-rule)",
        rulestrong: "var(--color-rule-strong)",
        accent: "var(--color-accent)",
        accentsoft: "var(--color-accent-soft)",
        warn: "var(--color-warn)",
        warnsoft: "var(--color-warn-soft)",
        ok: "var(--color-ok)",
        oksoft: "var(--color-ok-soft)",
        danger: "var(--color-danger)",
        dangersoft: "var(--color-danger-soft)"
      },
      boxShadow: {
        panel: "0 1px 2px color-mix(in oklch, var(--color-ink) 8%, transparent)"
      }
    }
  }
};
