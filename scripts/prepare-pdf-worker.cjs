const fs = require("node:fs");
const path = require("node:path");

// A same-origin worker keeps the server PDF engine independent of webpack.
const destination = path.resolve(__dirname, "../public/pdf.worker.min.mjs");
fs.copyFileSync(require.resolve("pdfjs-dist/build/pdf.worker.min.mjs"), destination);
