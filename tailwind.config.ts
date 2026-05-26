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
        gold: {
          50:  "#fdf9ec",
          100: "#faf0cc",
          200: "#f5de95",
          300: "#efc85a",
          400: "#e8b429",
          500: "#d49a12",
          600: "#b87a0d",
          700: "#8f580e",
          800: "#764512",
          900: "#643a14",
          950: "#3a1e06",
        },
        obsidian: {
          50:  "#f5f5f6",
          100: "#e6e6e8",
          200: "#cfcfd3",
          300: "#adadb4",
          400: "#84848e",
          500: "#696973",
          600: "#595962",
          700: "#4b4b53",
          800: "#424248",
          900: "#3a3a3f",
          950: "#0a0a0c",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #d49a12 0%, #f5de95 50%, #d49a12 100%)",
        "hero-radial": "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,154,18,0.12) 0%, transparent 70%)",
      },
      animation: {
        "fade-up": "fadeUp 0.6s ease-out both",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
