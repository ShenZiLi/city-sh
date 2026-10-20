import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
await fs.mkdir("public/assets", { recursive: true });
for (const file of await fs.readdir("art/originals")) {
  const id = path.basename(file, ".png");
  if (!/^(T\d\d|S\d\d|D\d\d)$/.test(id)) continue;
  if (id.startsWith("D"))
    await fs.copyFile(`art/originals/${file}`, `public/assets/${file}`);
  else
    await sharp(`art/originals/${file}`)
      .resize({
        width:
          id === "T05" || id === "T11" ? 1536 : id.startsWith("S") ? 1536 : 768,
        withoutEnlargement: true,
      })
      .webp({ quality: 86 })
      .toFile(`public/assets/${id}.webp`);
  console.log(`Prepared ${id}`);
}
await sharp("art/originals/C01.png")
  .resize(1000)
  .webp({ quality: 86 })
  .toFile("public/assets/concept-day.webp");
