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
          red: "#1a1a1a",
          darkRed: "#1a1a1a",
          ink: "#1a1a1a",
          gray: "#ffffff",
          line: "#e8e8e8",
          paper: "#ffffff",
          card: "#ffffff",
          sage: "#67705e",
          sageDark: "#4f5948",
          teal: "#67705e",
          brown: "#806642"
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
