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
        brand: {
          DEFAULT: "rgb(var(--color-brand) / <alpha-value>)",
          strong: "rgb(var(--color-brand-strong) / <alpha-value>)",
          soft: "rgb(var(--color-brand-soft) / <alpha-value>)",
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
    },
  },
  plugins: [],
};

export default config;
