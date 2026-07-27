import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#13251d",
        paper: "#fafafa",
        // Warmer, more saturated peach - the muted beige read as "dull"
        // next to Vivian's actual palette.
        cream: {
          DEFAULT: "#FBE3D0",
          50: "#FDF1E6",
          100: "#FBE3D0",
        },
        // Punchier, more saturated emerald - the old shades were too
        // desaturated/dark to read as "vivid" the way Vivian's does.
        forest: {
          50: "#E6F6EE",
          100: "#BFE7D3",
          400: "#159D6B",
          500: "#12915F",
          600: "#0E7A54",
          700: "#0A5F41",
          900: "#06402C",
        },
        // Coral/terracotta accent for tags and secondary highlights, matching
        // the warm orange-red used for labels like "Travel Contract".
        coral: {
          50: "#FCEBE0",
          100: "#F8D2B8",
          600: "#C2410C",
          700: "#9A3209",
        },
        accent: "#0E7A54",
        warn: "#C2410C",
        good: "#0E7A54",
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
