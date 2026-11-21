import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { extname } from "node:path";

const project = new URL("../", import.meta.url);
const read = (path, encoding) => readFile(new URL(path, project), encoding);
const scriptNames = ["save-sync.js", "forest.js", "today-notes.js", "experiment-dog.js", "ranch.js"];
const [template, forestCss, ranchCss, ...scripts] = await Promise.all(
  ["index.html", "forest.css", "ranch.css", ...scriptNames].map(path => read(path, "utf8")),
);

const html = template
  .replace("<title>生命森林</title>", "<title>生命森林 · 离线试玩版</title>")
  .replace(/^[ \t]*<link rel="stylesheet"[^>]*>\r?\n/gm, "")
  .replace(/^[ \t]*<script src="\.\/[^"<>]+" defer><\/script>\r?\n/gm, "")
  .replace(/<button\b[^>]*\bid="open-account"[^>]*>[\s\S]*?<\/button>/, "")
  .replace(/<img\b[^>]*\bclass="account-art"[^>]*>/, "");

const cssAssets = new Map();
const css = `${forestCss}\n${ranchCss}`.replace(/url\("(\.\/assets\/[^"()]+)"\)/g, (_, path) => {
  if (!cssAssets.has(path)) cssAssets.set(path, `--preview-asset-${cssAssets.size}`);
  return `var(${cssAssets.get(path)})`;
});

const mimeTypes = { ".webp": "image/webp", ".png": "image/png", ".mp3": "audio/mpeg" };
const assetPaths = new Set(cssAssets.keys());
for (const path of [html, ...scripts].join("\n").matchAll(/\.\/assets\/[^\s"'`<>$()]+\.(?:webp|png|mp3)/g)) {
  assetPaths.add(path[0]);
}

// These paths are assembled from the crop, tool or animal being rendered.
for (const folder of ["growth", "tools", "sfx", "ranch", "action-icons"]) {
  const directory = `./assets/${folder}/`;
  for (const entry of await readdir(new URL(directory, project), { withFileTypes: true })) {
    if (entry.isFile() && Object.hasOwn(mimeTypes, extname(entry.name))) assetPaths.add(directory + entry.name);
  }
}

const assets = Object.fromEntries(await Promise.all([...assetPaths].sort().map(async path => [
  path, [mimeTypes[extname(path)], (await read(path)).toString("base64")],
])));
const bootstrap = `(() => {
  const assets = ${JSON.stringify(assets)};
  const assetUrl = path => {
    const asset = assets[path];
    if (typeof asset === "string") return asset;
    if (!asset) throw new Error("Missing preview asset: " + path);
    const [type, encoded] = asset;
    const raw = atob(encoded);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    return assets[path] = URL.createObjectURL(new Blob([bytes], { type }));
  };
  globalThis.forestPreviewAssetUrl = assetUrl;
  for (const [path, property] of ${JSON.stringify([...cssAssets])}) {
    document.documentElement.style.setProperty(property, 'url("' + assetUrl(path) + '")');
  }
  for (const attribute of ["src", "href"]) {
    const key = "data-preview-" + attribute;
    for (const element of document.querySelectorAll("[" + key + "]")) {
      element.setAttribute(attribute, assetUrl(element.getAttribute(key)));
      element.removeAttribute(key);
    }
  }
})();`;

const inlineScript = source => `<script>\n${source.replace(/<\/script/gi, "<\\/script")}\n</script>`;
const document = html
  .replace(/\b(src|href)="(\.\/assets\/[^"<>]+)"/g, 'data-preview-$1="$2"')
  .replace("</head>", () => `<style>\n${css}\n</style>\n</head>`)
  .replace("</body>", () => `${[bootstrap, ...scripts].map(inlineScript).join("\n")}\n</body>`);

const output = new URL("dist/", project);
await mkdir(output, { recursive: true });
await writeFile(new URL("life-forest-preview.html", output), document, "utf8");
console.log(`dist/life-forest-preview.html · ${(Buffer.byteLength(document) / 2 ** 20).toFixed(1)} MiB · ${assetPaths.size} assets`);
