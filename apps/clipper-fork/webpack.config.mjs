import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import CopyPlugin from "copy-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import TerserPlugin from "terser-webpack-plugin";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isProduction = process.env.NODE_ENV === "production";
const outDir = isProduction ? "dist-extension" : "dev-extension";

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

export default {
	mode: isProduction ? "production" : "development",
	entry: {
		background: "./src/background.ts",
		popup: "./src/popup.ts",
		content: "./src/content.ts",
		highlighter: "./src/highlighter.scss",
	},
	output: {
		path: path.resolve(__dirname, outDir),
		filename: "[name].js",
	},
	devtool: isProduction ? false : "source-map",
	optimization: {
		minimize: isProduction,
		minimizer: [
			new TerserPlugin({
				terserOptions: {
					mangle: false,
					compress: { defaults: true, unused: true, dead_code: true, passes: 2, ecma: 2020 },
					format: { ascii_only: true, comments: false, ecma: 2020 },
					keep_classnames: true,
					keep_fnames: true,
				},
				extractComments: false,
			}),
		],
	},
	resolve: {
		extensions: [".ts", ".js"],
	},
	module: {
		rules: [
			{
				test: /\.tsx?$/,
				use: [{ loader: "ts-loader", options: { compilerOptions: { module: "ES2020" } } }],
				exclude: /node_modules/,
			},
			{
				test: /\.scss$/,
				use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
			},
			{
				test: /\.css$/,
				use: [MiniCssExtractPlugin.loader, "css-loader"],
			},
			{
				resolve: {
					fullySpecified: false,
				},
			},
		],
	},
	plugins: [
		new CopyPlugin({
			patterns: [
				{ from: "extension-manifest.json", to: "manifest.json" },
				{ from: "popup.html", to: "popup.html" },
				{ from: "src/flatten-shadow-dom.js", to: "flatten-shadow-dom.js" },
				{ from: "icons", to: "icons", noErrorOnMissing: true },
			],
		}),
		new MiniCssExtractPlugin({ filename: "[name].css" }),
	],
};
