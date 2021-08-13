module.exports = {
  plugins: [
    require("postcss-easy-import"),
    // require("tailwindcss"),
    require("autoprefixer"),
    process.env.NODE_ENV === "production" && require("cssnano")
  ].filter(Boolean)
};
