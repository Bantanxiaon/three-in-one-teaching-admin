import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/app/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}"
  ],
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: "1rem",
        md: "2rem",
        xl: "4rem"
      },
      screens: {
        "2xl": "1400px"
      }
    },
    extend: {
      colors: {
        ivory: "#F7F2E8",
        pearl: "#FBFAF7",
        mist: "#E8E6E1",
        graphite: "#2B2B2A",
        piano: "#050505",
        gold: "#B89B5E",
        champagne: "#D8C7A0",
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))"
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))"
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))"
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "Inter", "Noto Sans SC", "Source Han Sans SC", "system-ui", "sans-serif"],
        display: ["var(--font-inter)", "Inter", "Noto Sans SC", "sans-serif"]
      },
      boxShadow: {
        luxury: "0 24px 80px rgba(5, 5, 5, 0.10)",
        line: "inset 0 -1px rgba(5, 5, 5, 0.08)"
      },
      letterSpacing: {
        luxury: "0.18em"
      },
      keyframes: {
        "soft-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" }
        }
      },
      animation: {
        "soft-pulse": "soft-pulse 4s ease-in-out infinite"
      }
    }
  },
  plugins: []
};

export default config;
