import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a1a2e",
        paper: "#fafafa",
        accent: "#1a5aa8",
        warn: "#c0392b",
        good: "#2f6b2f",
      },
    },
  },
  plugins: [],
};
export default config;
