/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["Drybrush", "serif"],
        sans: ["Now", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      colors: {
        ink: "#1b1510",
        rice: "#f5efe3",
        paper: "#f5efe3",
        "paper-light": "#fbf7ed",
        cinnabar: "#b63326",
        jade: "#1f7a5a",
        gold: "#c8972b",
        night: "#191b1f"
      },
      boxShadow: {
        panel: "0 24px 70px rgba(17, 17, 17, 0.16)"
      }
    }
  },
  plugins: []
};
