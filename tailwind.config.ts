import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Satoshi", "system-ui", "-apple-system", "sans-serif"],
        mono: ["Satoshi", "system-ui", "-apple-system", "sans-serif"],
      },
      fontSize: {
        'page-title': ['1.625rem', { lineHeight: '2rem', letterSpacing: '-0.04em', fontWeight: '600' }],
        'section-title': ['1.125rem', { lineHeight: '1.625rem', letterSpacing: '-0.025em', fontWeight: '600' }],
        'table-header': ['0.8125rem', { lineHeight: '1.125rem', letterSpacing: '0.04em', fontWeight: '600' }],
        'metric-label': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.12em', fontWeight: '600' }],
        'metric-value': ['1.5rem', { lineHeight: '1.75rem', letterSpacing: '-0.02em', fontWeight: '500' }],
      },
      spacing: {
        'dls-xs': '4px',
        'dls-sm': '8px',
        'dls-md': '16px',
        'dls-lg': '24px',
        'dls-xl': '32px',
        'dls-2xl': '48px',
        'dls-3xl': '64px',
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        validated: {
          DEFAULT: "hsl(var(--validated))",
          foreground: "hsl(var(--validated-foreground))",
        },
        discrepancy: {
          DEFAULT: "hsl(var(--discrepancy))",
          foreground: "hsl(var(--discrepancy-foreground))",
        },
        blocking: {
          DEFAULT: "hsl(var(--blocking))",
          foreground: "hsl(var(--blocking-foreground))",
        },
        // Icon color system
        "icon-escrow": "hsl(var(--icon-escrow))",
        "icon-success": "hsl(var(--icon-success))",
        "icon-pending": "hsl(var(--icon-pending))",
        "icon-growth": "hsl(var(--icon-growth))",
        "icon-risk": "hsl(var(--icon-risk))",
        "icon-neutral": "hsl(var(--icon-neutral))",
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
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
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-in-scale": {
          from: { opacity: "0", transform: "scale(0.97) translateY(6px)" },
          to: { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-up-fade": {
          from: { opacity: "0", transform: "translateY(12px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.6" },
          "50%": { opacity: "1" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.3s ease-out forwards",
        "fade-in-scale": "fade-in-scale 0.35s ease-out forwards",
        "slide-up-fade": "slide-up-fade 0.4s ease-out forwards",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
