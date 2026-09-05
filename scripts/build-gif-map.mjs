/**
 * Builds src/data/exercise-gifs.json — a map of our exercise id -> GIF id in
 * omercotkd/exercises-gifs (MIT-licensed mirror of the Kaggle "Fitness
 * Exercises with Animations" set, served via the jsDelivr CDN).
 *
 *   npm run build:gif-map
 *
 * Most of our ids are ExerciseDB-style numerics that match the GIF filenames
 * exactly; the rest are matched on normalised name/alias. The result is
 * committed so the app never does this lookup at runtime.
 */
import { readFileSync, writeFileSync } from "node:fs";

const REPO = "omercotkd/exercises-gifs";
const ours = JSON.parse(readFileSync("src/data/exercises.json", "utf8"));

const branch = await (
  await fetch(`https://api.github.com/repos/${REPO}/branches/main`)
).json();
const tree = await (
  await fetch(
    `https://api.github.com/repos/${REPO}/git/trees/${branch.commit.sha}?recursive=1`,
  )
).json();

const gifs = new Set(
  tree.tree
    .filter((n) => n.path.startsWith("assets/") && n.path.endsWith(".gif"))
    .map((n) => n.path.slice("assets/".length, -".gif".length)),
);

const csv = await (
  await fetch(`https://raw.githubusercontent.com/${REPO}/main/exercises.csv`)
).text();

// Token-set normalization: order-, plural- and punctuation-insensitive, with
// known dataset typos fixed — so "Triceps Dips" finds "triceps dip".
const norm = (s) =>
  s
    .toLowerCase()
    .replace(/bycicle/g, "bicycle")
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.replace(/s$/, ""))
    .filter((t) => !["drv", "the", "a", "an", "with", "on", "degree"].includes(t))
    .sort()
    .join(" ");
const byName = new Map();
for (const line of csv.split("\n").slice(1)) {
  const cols = line.split(",");
  if (cols.length > 4 && /^\d+$/.test(cols[2]) && !byName.has(norm(cols[3]))) {
    byName.set(norm(cols[3]), cols[2]);
  }
}

const map = {};
let direct = 0;
let byNameCount = 0;

for (const e of ours) {
  if (gifs.has(e.id)) {
    map[e.id] = e.id;
    direct += 1;
    continue;
  }
  const keys = [e.name, ...(e.aliases ?? [])].map(norm);
  const hit = keys.map((k) => byName.get(k)).find((id) => id && gifs.has(id));
  if (hit) {
    map[e.id] = hit;
    byNameCount += 1;
  }
}

writeFileSync(
  "src/data/exercise-gifs.json",
  JSON.stringify(map, null, 0) + "\n",
);

const total = direct + byNameCount;
console.log(`\n  GIFs in source: ${gifs.size}`);
console.log(`  matched by id:   ${direct}`);
console.log(`  matched by name: ${byNameCount}`);
console.log(
  `  coverage: ${total}/${ours.length} (${Math.round((total / ours.length) * 100)}%)`,
);
console.log(`  written to src/data/exercise-gifs.json\n`);
