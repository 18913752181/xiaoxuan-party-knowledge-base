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
          red: "#a63e47",
          darkRed: "#873039",
          ink: "#1b1f24",
          gray: "#f6f7f9",
          line: "#e3e7eb",
          paper: "#fafbfc",
          card: "#ffffff",
          sage: "#637a70",
          sageDark: "#50695d",
          teal: "#637a70",
          brown: "#8a6b50"
        }
      },
      boxShadow: {
        soft: "0 10px 28px rgba(65, 56, 50, 0.055)"
      }
    }
  },
  plugins: []
};

export default config;
