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
        ivory: "#FFFFFF",
        paper: "#F4F9FF",
        ink: "#082657",
        coral: "#4A90E2",
        sunset: "#84B5EC",
        sage: "#DCEEFF",
        lavender: "#EAF2FD",
        line: "#D6E5F7",
      },
      boxShadow: {
        card: "0 10px 28px rgba(38, 92, 154, 0.10)",
        phone: "0 18px 50px rgba(24, 74, 132, 0.14)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
