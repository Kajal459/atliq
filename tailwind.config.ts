import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a2e26",
        paper: "#fafafa",
        cream: {
          DEFAULT: "#FBEADD",
          50: "#FDF6EF",
          100: "#FBEADD",
        },
        forest: {
          50: "#EAF3EE",
          100: "#CFE6DA",
          400: "#3E7A62",
          600: "#1F4D3D",
          700: "#163B2E",
          900: "#0E2A20",
        },
        accent: "#1F4D3D",
        warn: "#c0392b",
        good: "#1F4D3D",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        serif: ["var(--font-voice)", "Georgia", "serif"],
      },
    },
  },
  plugins: [],
};
export default config;
