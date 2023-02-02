import * as esbuild from "esbuild";

const JS_FROM = "index.jsx";

await esbuild.build({
  entryPoints: [JS_FROM],
  bundle: true,
  minify: true,
  platform: "node",
  outfile: `build.js`,
  packages: "external",
  legalComments: "none",
  pure: ["console"],
});
