import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const manifest = JSON.parse(
  await readFile(new URL("../public/models/manifest.json", import.meta.url)),
);
for (const [file, hash] of Object.entries(manifest.sha256)) {
  const data = await readFile(new URL("../public/" + file, import.meta.url));
  if (createHash("sha256").update(data).digest("hex") !== hash)
    throw new Error("Bundled asset checksum mismatch: " + file);
}
console.log("Verified bundled model, decoder and inference-runtime checksums.");
