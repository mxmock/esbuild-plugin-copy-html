import * as esbuild from "esbuild";
import copyHtmlPlugin from "../index.js";

const OUT_DIR = "test/build";
const JS_FROM = "test/main.js";
const HTML_FROM = "test/pages";

let ctx = await esbuild.context({
  entryPoints: [JS_FROM, "test/test.js"],
  bundle: true,
  plugins: [
    copyHtmlPlugin({
      htmlFromDir: HTML_FROM,
      outDir: `${OUT_DIR}`,
      jsDir: `${OUT_DIR}/js`,
      // cssDir: `${OUT_DIR}/css`,
    }),
  ],
  outdir: `${OUT_DIR}/js`,
});

await ctx.watch();
