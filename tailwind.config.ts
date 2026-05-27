import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // Editorial neutral — light-mode scale
        ink: {
          50:  "#FFFFFF",
          100: "#F8F8F8",
          200: "#EFEFEF",
          300: "#DCDCDC",
          400: "#ABABAB",
          500: "#737373",
          600: "#525252",
          700: "#363636",
          800: "#212121",
          900: "#141414",
          950: "#0A0A0A",
        },
        // Sophisticated muted gold — #C9A84C as the hero accent
        gold: {
          50:  "#fdf8ee",
          100: "#f8ecce",
          200: "#f0d79d",
          300: "#e6bc6a",
          400: "#dba240",
          500: "#C9A84C",
          600: "#a8863a",
          700: "#86672c",
          800: "#6b5227",
          900: "#574421",
          950: "#2e2310",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #C9A84C 0%, #E8C875 50%, #C9A84C 100%)",
      },
      animation: {
        "fade-up": "fadeUp 0.5s ease-out both",
      },
      keyframes: {
        fadeUp: {
          "0%":   { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
