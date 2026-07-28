/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        app: "#0a0f0d",
        accent: "#20C683",
        muted: "#95B5A9",
        panel: "#111917",
        stroke: "rgba(149, 181, 169, 0.18)",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(32, 198, 131, 0.15), 0 24px 60px rgba(0, 0, 0, 0.35)",
      },
      fontFamily: {
        sans: ["Satoshi", "Inter", "system-ui", "sans-serif"],
        mono: ["Space Mono", "ui-monospace", "SFMono-Regular", "monospace"],
      },
    },
  },
  plugins: [],
};
