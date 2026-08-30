import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ivory: "rgb(var(--ivory-rgb) / <alpha-value>)",
        paper: "rgb(var(--paper-rgb) / <alpha-value>)",
        ink: "rgb(var(--ink-rgb) / <alpha-value>)",
        coral: "rgb(var(--accent-rgb) / <alpha-value>)",
        sunset: "rgb(var(--sunset-rgb) / <alpha-value>)",
        sage: "rgb(var(--sage-rgb) / <alpha-value>)",
        lavender: "rgb(var(--lavender-rgb) / <alpha-value>)",
        line: "rgb(var(--line-rgb) / <alpha-value>)",
      },
      boxShadow: {
        card: "0 10px 28px rgb(var(--accent-rgb) / 0.10)",
        phone: "0 18px 50px rgb(var(--ink-rgb) / 0.14)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
