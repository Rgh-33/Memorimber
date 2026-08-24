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
        ivory: "#FBF8F1",
        paper: "#F5EFE5",
        ink: "#202C46",
        coral: "#EF7668",
        sunset: "#F3A05B",
        sage: "#AAC8B8",
        lavender: "#DED5EE",
        line: "#E6DCCF",
      },
      boxShadow: {
        card: "0 14px 40px rgba(53, 45, 35, 0.08)",
        phone: "0 18px 50px rgba(53, 45, 35, 0.16)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
  plugins: [],
};

export default config;
