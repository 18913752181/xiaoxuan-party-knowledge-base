import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          red: "#8f1d22",
          darkRed: "#651419",
          ink: "#4b4f4d",
          gray: "#f7f4ee",
          line: "#e7e1d8",
          paper: "#fbf8f1",
          card: "#ffffff",
          sage: "#6f8b7b",
          sageDark: "#49695c",
          teal: "#5f8986",
          brown: "#9a795b"
        }
      },
      boxShadow: {
        soft: "0 10px 24px rgba(68, 57, 45, 0.07)"
      }
    }
  },
  plugins: []
};

export default config;
