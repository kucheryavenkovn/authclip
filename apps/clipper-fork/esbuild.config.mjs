import esbuild from "esbuild";
import { readFileSync, writeFileSync, copyFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";
import { deflateSync } from "zlib";

const outDir = "dist-extension";
const isProd = process.env.NODE_ENV === "production";

if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });

await Promise.all([
  esbuild.build({
    entryPoints: ["src/background.ts"],
    bundle: true,
    format: "iife",
    target: "chrome120",
    outfile: join(outDir, "background.js"),
    minify: isProd,
    sourcemap: !isProd,
    logLevel: "info",
  }),

  esbuild.build({
    entryPoints: ["src/popup.ts"],
    bundle: true,
    format: "iife",
    target: "chrome120",
    outfile: join(outDir, "popup.js"),
    minify: isProd,
    sourcemap: !isProd,
    logLevel: "info",
  }),
]);

copyFileSync("popup.html", join(outDir, "popup.html"));

const manifest = JSON.parse(readFileSync("extension-manifest.json", "utf8"));
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));

mkdirSync(join(outDir, "icons"), { recursive: true });
generateDefaultIcons(outDir);

console.log(`AuthClip browser extension built -> ${outDir}/`);

function generateDefaultIcons(outDir) {
  const sizes = [16, 48, 128];
  for (const size of sizes) {
    const path = join(outDir, "icons", `icon${size}.png`);
    if (!existsSync(path)) {
      writeFileSync(path, createMinimalPNG(size));
    }
  }
}

function createMinimalPNG(size) {
  const rowBytes = size * 4;
  const rawRow = Buffer.alloc(rowBytes);
  for (let i = 0; i < rowBytes; i += 4) {
    rawRow[i] = 124;
    rawRow[i + 1] = 58;
    rawRow[i + 2] = 237;
    rawRow[i + 3] = 255;
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(size, 0);
  ihdrData.writeUInt32BE(size, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const ihdr = createChunk("IHDR", ihdrData);

  const rawData = Buffer.alloc(size * (rowBytes + 1));
  for (let y = 0; y < size; y++) {
    rawData[y * (rowBytes + 1)] = 0;
    rawRow.copy(rawData, y * (rowBytes + 1) + 1);
  }
  const idat = createChunk("IDAT", deflateSync(rawData));
  const iend = createChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

function createChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeB = Buffer.from(type, "ascii");
  const crc = crc32(Buffer.concat([typeB, data]));
  const crcB = Buffer.alloc(4);
  crcB.writeUInt32BE(crc >>> 0, 0);
  return Buffer.concat([len, typeB, data, crcB]);
}

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return crc ^ 0xffffffff;
}
