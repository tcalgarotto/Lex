import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import tailwindcssTypography from "@tailwindcss/typography";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
      },
      fontSize: {
        xs: ["var(--text-xs)", { lineHeight: "1.5" }],
        sm: ["var(--text-sm)", { lineHeight: "1.5" }],
        base: ["var(--text-base)", { lineHeight: "1.5" }],
        /** P1 — tokens semânticos (`globals.css` --text-micro … --text-readable) */
        micro: ["var(--text-micro)", { lineHeight: "var(--leading-tight-readable)" }],
        caption: ["var(--text-caption)", { lineHeight: "var(--leading-readable)" }],
        section: ["var(--text-section-title)", { lineHeight: "var(--leading-tight-readable)" }],
        control: ["var(--text-control)", { lineHeight: "var(--leading-tight-readable)" }],
        body: ["var(--text-body)", { lineHeight: "var(--leading-readable)" }],
        readable: ["var(--text-readable)", { lineHeight: "var(--leading-tight-readable)" }],
        /** Hierarquia Lex — mapeia para --lex-type-* (aliases dos tokens P1) */
        "lex-micro": ["var(--lex-type-micro-size)", { lineHeight: "var(--lex-lh-micro)" }],
        "lex-subtle": ["var(--lex-type-subtle-size)", { lineHeight: "var(--lex-lh-micro)" }],
        "lex-eyebrow": ["var(--lex-type-eyebrow-size)", { lineHeight: "var(--lex-lh-micro)" }],
        "lex-eyebrow-lg": ["var(--lex-type-eyebrow-lg-size)", { lineHeight: "var(--lex-lh-micro)" }],
        "lex-rail": ["var(--lex-type-rail-size)", { lineHeight: "var(--lex-lh-snug)" }],
        "lex-detail": ["var(--lex-type-detail-size)", { lineHeight: "var(--lex-lh-snug)" }],
        "lex-compact": ["var(--lex-type-compact-size)", { lineHeight: "var(--lex-lh-snug)" }],
        "lex-caption": ["var(--lex-type-caption-size)", { lineHeight: "var(--lex-lh-ui)" }],
        "lex-section": ["var(--lex-type-section-size)", { lineHeight: "var(--lex-lh-snug)" }],
        "lex-metric": ["var(--lex-type-metric-size)", { lineHeight: "var(--lex-lh-snug)" }],
        "lex-card-title": ["var(--lex-type-card-title-size)", { lineHeight: "var(--lex-lh-snug)" }],
        "lex-cta": ["var(--lex-type-cta-size)", { lineHeight: "var(--lex-lh-snug)" }],
        "lex-badge": ["var(--lex-type-badge-size)", { lineHeight: "var(--lex-lh-micro)" }],
        "lex-badge-em": ["var(--lex-type-badge-em-size)", { lineHeight: "var(--lex-lh-micro)" }],
        "lex-phase": ["var(--lex-type-phase-size)", { lineHeight: "var(--lex-lh-micro)" }],
        "lex-ultra": ["var(--lex-type-ultra-size)", { lineHeight: "1.15" }],
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      fontFamily: {
        sans: [
          '"Atkinson Hyperlegible"',
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "BlinkMacSystemFont",
          '"Segoe UI"',
          "sans-serif",
        ],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        serif: ["var(--font-serif)", "Georgia", "serif"],
      },
      ringOffsetColor: {
        background: "hsl(var(--background) / <alpha-value>)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        shimmer: "shimmer 2s infinite",
      },
    },
  },
  plugins: [tailwindcssAnimate, tailwindcssTypography],
};

export default config;
