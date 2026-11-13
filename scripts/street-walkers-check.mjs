// Passants : ils restent sur le réseau piéton et passent d'un tronçon à l'autre (décision du 13 novembre 2026).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { createWalkers } = await import('../src/street-walkers.ts')
const walks = JSON.parse(readFileSync(new URL('../src/data/road-network.json', import.meta.url), 'utf8')).walks
const crowd = createWalkers(walks, 44)
assert.equal(crowd.walkers.length, 44)
// Distance d'un point au tracé du réseau.
const segments = walks.flatMap(w => w.slice(1).map((b, i) => [w[i], b]))
const away = (x, z) => Math.min(...segments.map(([a, b]) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)); return Math.hypot(a[0] + dx * t - x, a[1] + dz * t - z) }))
const visited = crowd.walkers.map(w => new Set([w.walk]))
let worst = 0, jump = 0
for (let frame = 0; frame < 6000; frame++) {
  const before = crowd.walkers.map(w => [w.x, w.z])
  crowd.step(.1)
  crowd.walkers.forEach((w, i) => { visited[i].add(w.walk); jump = Math.max(jump, Math.hypot(w.x - before[i][0], w.z - before[i][1])) })
  if (frame % 300 === 0) for (const w of crowd.walkers) worst = Math.max(worst, away(w.x, w.z))
}
assert.ok(worst < .05, `un passant sort du réseau (${worst.toFixed(2)})`)
assert.ok(jump < 1.3, `un passant se téléporte (${jump.toFixed(2)})`)
const travellers = visited.filter(set => set.size > 1).length
assert.ok(travellers >= 30, `trop peu de passants changent de tronçon (${travellers}/44)`)
console.log(`Passants : sur le réseau (écart max ${worst.toFixed(3)}), pas de saut > ${jump.toFixed(2)}, ${travellers}/44 changent de tronçon`)
