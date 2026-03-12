import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        /* semantic theme tokens (shadcn/ui) mapped to CSS variables */
        background: "var(--background)",
        foreground: "var(--foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        border: "var(--border)",
        muted: "var(--muted)",

        /* still expose some of the custom roles for legacy use */
        destructive: "#ef4444",
        neutral: {
          50: "#f9fafb",
          100: "#f3f4f6",
          200: "#e5e7eb",
          300: "#d1d5db",
          400: "#9ca3af",
          500: "#6b7280",
          600: "#4b5563",
          700: "#374151",
          800: "#1f2937",
          900: "#111827",
        },

        /* additional semantic helpers (optional) */
        "brand-primary": "var(--primary)",
        "brand-primary-hover": "#6a1415",
        "brand-primary-active": "#5c1214",
        "accent-gold": "var(--accent)",
        "accent-gold-muted": "#fce9b2",
        focus: "var(--primary)",
        "badge-priority": "var(--accent)",
        "card-accent": "var(--primary)",

        /* legacy names for white/gray usage (keep for convenience) */
        card: "#ffffff",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        4: "16px",
        5: "20px",
        6: "24px",
        8: "32px",
        10: "40px",
        12: "48px",
      },
      borderRadius: {
        DEFAULT: "0.5rem", // 8px
        lg: "0.75rem",
        xl: "1rem",
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.1)",
        cardHover: "0 4px 6px rgba(0,0,0,0.1)",
      },
      fontFamily: {
        sans: ["DM Sans", "sans-serif"],
        heading: ["Plus Jakarta Sans", "sans-serif"],
      },
      fontSize: {
        base: "14px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
      },
    },
  },
  plugins: [],
};

export default config;
