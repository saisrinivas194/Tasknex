import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Jira-style: blue primary, neutrals
        primary: {
          DEFAULT: "#0052CC",
          50: "#DEEBFF",
          100: "#B3D4FF",
          200: "#4C9AFF",
          300: "#2684FF",
          400: "#0065FF",
          500: "#0052CC",
          600: "#0747A6",
          700: "#003366",
          800: "#002B4D",
          900: "#001A33",
        },
        success: "#00875A",
        navy: {
          DEFAULT: "#172B4D",
          card: "#1E3A5F",
          panel: "#253858",
        },
        muted: "#97A0AF",
      },
      boxShadow: {
        soft: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
        card: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
      },
    },
  },
  plugins: [],
};
export default config;
