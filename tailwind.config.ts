import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        semiconductor: {
          blue: "#1a3c6e",
          teal: "#00a8b5",
          gray: "#4a5568",
          light: "#e8f4f8",
        },
      },
    },
  },
  plugins: [],
};
export default config;
