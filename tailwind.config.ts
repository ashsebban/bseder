import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--color-canvas) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        surfaceMuted: "rgb(var(--color-surface-muted) / <alpha-value>)",
        line: "rgb(var(--color-line) / <alpha-value>)",
        text: {
          DEFAULT: "rgb(var(--color-text) / <alpha-value>)",
          muted: "rgb(var(--color-text-muted) / <alpha-value>)",
          subtle: "rgb(var(--color-text-subtle) / <alpha-value>)",
        },
        label: "rgb(var(--color-text-muted) / <alpha-value>)",
        muted: "rgb(var(--color-text-subtle) / <alpha-value>)",
        subtle: "rgb(var(--color-line) / <alpha-value>)",
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          strong: "rgb(var(--color-brand-strong) / <alpha-value>)",
          soft: "rgb(var(--color-brand-soft) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "rgb(var(--color-destructive) / <alpha-value>)",
          strong: "rgb(var(--color-destructive-strong) / <alpha-value>)",
          soft: "rgb(var(--color-destructive-soft) / <alpha-value>)",
          line: "rgb(var(--color-destructive-line) / <alpha-value>)",
        },
        warning: {
          DEFAULT: "rgb(var(--color-warning) / <alpha-value>)",
          strong: "rgb(var(--color-warning-strong) / <alpha-value>)",
          soft: "rgb(var(--color-warning-soft) / <alpha-value>)",
          line: "rgb(var(--color-warning-line) / <alpha-value>)",
        },
        urgent: {
          DEFAULT: "rgb(var(--color-urgent) / <alpha-value>)",
          soft: "rgb(var(--color-urgent-soft) / <alpha-value>)",
        },
        success: {
          DEFAULT: "rgb(var(--color-success) / <alpha-value>)",
          soft: "rgb(var(--color-success-soft) / <alpha-value>)",
        },
        planned: "rgb(var(--color-planned) / <alpha-value>)",
        penalty: "rgb(var(--color-penalty) / <alpha-value>)",
      },
      boxShadow: {
        panel: "0 24px 60px rgba(73, 104, 161, 0.12)",
        soft: "0 10px 30px rgba(26, 42, 78, 0.08)",
      },
      borderRadius: {
        xl: "1rem",
        '2xl': "1.5rem",
        '3xl': "2rem",
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "sans-serif"],
      },
      fontSize: {
        caption: ["10px", { lineHeight: "1.2" }],
        "type-label": ["11px", { lineHeight: "1.25" }],
        body: ["13px", { lineHeight: "1.4" }],
        "body-md": ["14px", { lineHeight: "1.45" }],
      },
    },
  },
  plugins: [],
};

export default config;
