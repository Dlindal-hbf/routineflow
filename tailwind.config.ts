import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2563eb", // calm blue
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#f59e0b", // amber for highlights/status
          foreground: "#000000",
        },
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
        background: "#f9fafb",
        card: "#ffffff",
        border: "#e5e7eb",
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
