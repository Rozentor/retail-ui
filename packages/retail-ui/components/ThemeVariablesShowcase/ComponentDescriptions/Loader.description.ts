export default {
  active: {
    contents: "css`\n  .${styles.loader}&::after {\n    background: ${t.loaderBg};\n    opacity: ${t.loaderOpacity};\n  }\n`",
    variables: [
      "loaderBg",
      "loaderOpacity"
    ]
  }
};