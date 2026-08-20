export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        espresso: "#1f1712",
        wood: "#2b211a",
        brass: "#c3a14a",
        rust: "#8b4a3f",
        moss: "#647a45",
        parchment: "#f0e6d8"
      },
      fontFamily: {
        display: ["Georgia", "Cambria", "serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Consolas", "monospace"]
      }
    }
  },
  plugins: []
};
