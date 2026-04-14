import esbuild from "esbuild";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync, rmSync } from "fs";
import { join, dirname } from "path";

const outDir = "dist";
const isProd = process.env.NODE_ENV === "production";

if (existsSync(outDir)) rmSync(outDir, { recursive: true });
mkdirSync(outDir, { recursive: true });

const pkg = JSON.parse(readFileSync("package.json", "utf8"));

await esbuild.build({
  entryPoints: ["src/main.ts"],
  bundle: true,
  platform: "node",
  external: ["obsidian"],
  format: "cjs",
  target: "es2022",
  outfile: join(outDir, "main.js"),
  minify: isProd,
  sourcemap: !isProd,
  treeShaking: true,
  logLevel: "info",
  define: {
    "process.env.NODE_ENV": JSON.stringify(isProd ? "production" : "development"),
  },
});

copyFileSync("manifest.json", join(outDir, "manifest.json"));
copyFileSync("styles.css", join(outDir, "styles.css"));

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));
manifest.version = pkg.version;
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

console.log(`AuthClip plugin built → ${outDir}/`);
