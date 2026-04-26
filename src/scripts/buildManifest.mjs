import fs from "fs";
import path from "path";

const dir = "public/data/train-timetables";
const files = fs
  .readdirSync(dir)
  .filter((f) => f.endsWith(".json") && f !== "_manifest.json")
  .sort();
fs.writeFileSync(
  path.join(dir, "_manifest.json"),
  JSON.stringify(files, null, 2),
);
console.log(`Manifest: ${files.length} files`);