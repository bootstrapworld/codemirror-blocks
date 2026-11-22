// A stylesheet imported as text (the bundler does the same with its `text` loader): `import css from "./x.css"` is the file's contents.
module.exports = {
  process(source) {
    return {
      code:
        "module.exports = { __esModule: true, default: " +
        JSON.stringify(source) +
        " };",
    };
  },
};
