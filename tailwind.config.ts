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
          red: "#a34f55",
          darkRed: "#884047",
          ink: "#30312f",
          gray: "#f5f5f3",
          line: "#e4e2dd",
          paper: "#fafaf8",
          card: "#fffefa",
          sage: "#718b7f",
          sageDark: "#536e62",
          teal: "#6d9190",
          brown: "#a37d56"
        }
      },
      boxShadow: {
        soft: "0 10px 28px rgba(56, 53, 48, 0.06)"
      }
    }
  },
  plugins: []
};

export default config;
