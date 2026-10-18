const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");
const root = path.resolve(__dirname, "..");

module.exports = function loader(mocks) {
  const cache = new Map();
  function load(name, parent = path.join(root, "entry.ts")) {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (!name.startsWith(".") && !name.startsWith("@/") && !path.isAbsolute(name)) return require(name);
    let file = name.startsWith("@/") ? path.join(root, "src", name.slice(2)) : path.resolve(path.dirname(parent), name);
    if (!path.extname(file)) file = [file + ".ts", file + ".tsx"].find(fs.existsSync);
    if (Object.hasOwn(mocks, file)) return mocks[file];
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} };
    cache.set(file, module);
    const source = ts.transpileModule(fs.readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true, jsx: ts.JsxEmit.ReactJSX },
    }).outputText;
    new vm.Script("(function(require,module,exports){" + source + "\n})", { filename: file })
      .runInThisContext()(dep => load(dep, file), module, module.exports);
    return module.exports;
  }
  return file => load(path.join(root, file));
};
