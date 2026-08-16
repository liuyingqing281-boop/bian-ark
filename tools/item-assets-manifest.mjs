import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = path.join(process.cwd(), "data", "uploads", "items", "official");
const output = path.join(root, "manifest.json");
const expected = [
  "flower_white", "flower_rose", "flower_lily", "candle", "incense", "joss_paper", "fruit", "wine", "teddy", "letter",
  "premium_custom_statue", "premium_gold_ingot", "premium_virtual_home", "premium_music", "premium_sky_lantern",
];

if (!fs.existsSync(root)) {
  console.error(`Missing asset directory: ${root}`);
  process.exit(1);
}

const assets = [];
for (const name of fs.readdirSync(root).filter((file) => /\.(png|webp|avif)$/i.test(file)).sort()) {
  const file = path.join(root, name);
  const buffer = fs.readFileSync(file);
  const meta = await sharp(buffer).metadata();
  assets.push({
    id: path.parse(name).name,
    file: name,
    width: meta.width,
    height: meta.height,
    format: meta.format,
    bytes: buffer.length,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  });
}

for (const id of expected.filter((item) => !assets.some((asset) => asset.id === item))) {
  assets.push({ id, file: null, missing: true });
}
assets.sort((a, b) => a.id.localeCompare(b.id));

fs.writeFileSync(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), assets }, null, 2)}\n`);
console.log(`Wrote ${assets.length} assets to ${path.relative(process.cwd(), output)}`);
