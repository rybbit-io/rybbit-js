import { defineConfig } from "tsup";
import { readFileSync } from "fs";
import { join } from "path";

const pkg = JSON.parse(readFileSync(join(__dirname, "package.json"), "utf-8"));
const sdkVersion = pkg.version;

const banner = {
  js: `/*!
 * ${pkg.name} v${sdkVersion}
 * ${pkg.description}
 * (c) ${new Date().getFullYear()} ${pkg.author}
 * Released under the ${pkg.license} license.
 */`
};

export default defineConfig({
  entry: ["src/index.ts"],
  outDir: "dist",
  format: ["cjs", "esm"],
  target: "es2017",
  sourcemap: false,
  dts: true,
  splitting: false,
  clean: true,
  minify: true,
  banner,
  external: ["rrweb"],
});
