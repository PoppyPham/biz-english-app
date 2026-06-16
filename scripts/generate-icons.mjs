import sharp from "sharp"
import { mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const root = join(dirname(fileURLToPath(import.meta.url)), "..")
const publicDir = join(root, "public")

// 1024×1024 master. Full-bleed dark square (iOS applies its own rounded mask),
// green speech bubble = "speaking English", bold "BE" monogram inside.
const svg = `
<svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
  <rect width="1024" height="1024" fill="#0F0F0F"/>
  <!-- speech bubble -->
  <path d="M 232 224
           h 560
           a 88 88 0 0 1 88 88
           v 304
           a 88 88 0 0 1 -88 88
           h -300
           l -150 132
           v -132
           h -110
           a 88 88 0 0 1 -88 -88
           v -304
           a 88 88 0 0 1 88 -88 z"
        fill="#22C55E"/>
  <!-- monogram -->
  <text x="512" y="495"
        font-family="Helvetica Neue, Helvetica, Arial, sans-serif"
        font-size="300" font-weight="700"
        fill="#0F0F0F" text-anchor="middle" dominant-baseline="central">BE</text>
</svg>`

const targets = [
  { name: "icon-512.png", size: 512 },
  { name: "icon-192.png", size: 192 },
  { name: "apple-icon.png", size: 180 }, // apple-touch-icon
  { name: "icon-1024.png", size: 1024 }, // master / store
]

await mkdir(publicDir, { recursive: true })
const buf = Buffer.from(svg)

for (const { name, size } of targets) {
  await sharp(buf, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(join(publicDir, name))
  console.log(`✓ ${name} (${size}×${size})`)
}
console.log("Done.")
