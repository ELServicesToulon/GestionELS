import { readFile, writeFile } from "node:fs/promises";

const src1x = "branding/ui/alu/alu-tile1x.png";
const src2x = "branding/ui/alu/alu-tile2x.png";
const out   = "branding/ui/alu/alu-embed.css";

/** retourne une chaîne CSS :root avec data:URI (1x/2x) */
const b64 = async (p) => (await readFile(p)).toString("base64");

export const css = async () => {
  const one = await b64(src1x);
  const two = await b64(src2x);
  return `:root {\n  --alu-tile-1x: url("data:image/png;base64,${one}");\n  --alu-tile-2x: url("data:image/png;base64,${two}");\n  --alu-size: 96px; /* taille nominale de la trame (1x) */\n  /* rétrocompatibilité */\n  --img-aluminium: image-set(var(--alu-tile-1x) 1x, var(--alu-tile-2x) 2x);\n}`;
};

async function main() {
  const content = await css();
  await writeFile(out, content, "utf8");
  console.log("✓ alu-embed.css generated");
}

;main();
