// Zip the contents of dist/ for itch.io: index.html at the top level, and
// forward slashes in every path. (Windows PowerShell's Compress-Archive writes
// backslashes, which itch.io does not read as folders.)
//
// Usage: node scripts/zip.mjs [outFile]   (default: molten.zip)
import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { deflateRawSync, crc32 } from 'node:zlib'

const root = 'dist'
const out = process.argv[2] ?? 'molten.zip'
if (!existsSync(join(root, 'index.html'))) {
  console.error('dist/index.html not found. Run "npm run build" first.')
  process.exit(1)
}

function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

// DOS date/time fields for the zip headers.
const now = new Date()
const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1)
const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()

const locals = []
const centrals = []
let offset = 0
for (const file of walk(root)) {
  const name = Buffer.from(relative(root, file).split(sep).join('/'))
  const data = readFileSync(file)
  const packed = deflateRawSync(data, { level: 9 })
  const crc = crc32(data)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4) // version needed
  local.writeUInt16LE(0x0800, 6) // UTF-8 names
  local.writeUInt16LE(8, 8) // deflate
  local.writeUInt16LE(dosTime, 10)
  local.writeUInt16LE(dosDate, 12)
  local.writeUInt32LE(crc, 14)
  local.writeUInt32LE(packed.length, 18)
  local.writeUInt32LE(data.length, 22)
  local.writeUInt16LE(name.length, 26)
  locals.push(local, name, packed)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4) // version made by
  central.writeUInt16LE(20, 6) // version needed
  central.writeUInt16LE(0x0800, 8)
  central.writeUInt16LE(8, 10)
  central.writeUInt16LE(dosTime, 12)
  central.writeUInt16LE(dosDate, 14)
  central.writeUInt32LE(crc, 16)
  central.writeUInt32LE(packed.length, 20)
  central.writeUInt32LE(data.length, 24)
  central.writeUInt16LE(name.length, 28)
  central.writeUInt32LE(offset, 42)
  centrals.push(central, name)

  offset += local.length + name.length + packed.length
  console.log(`  ${name}`)
}

const centralSize = centrals.reduce((n, b) => n + b.length, 0)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(centrals.length / 2, 8)
end.writeUInt16LE(centrals.length / 2, 10)
end.writeUInt32LE(centralSize, 12)
end.writeUInt32LE(offset, 16)

writeFileSync(out, Buffer.concat([...locals, ...centrals, end]))
console.log(`Wrote ${out} (${centrals.length / 2} files)`)
