/*
 * Bâtiments remodelés dans le style de l'ancien jeu « MVP Responsable » : volumes simples, aplats de couleur,
 * contours noirs, cases à toit de tôle ondulée, immeubles à fenêtres en grille, balcons et château d'eau.
 * Chaque bâtiment d'origine est mesuré (emprise orientée, hauteur) puis remplacé par un volume construit ici,
 * au même endroit. Les monuments et bâtiments à enseigne gardent leur modèle (voir remodeledBuilding).
 */
import type { Scene } from '@babylonjs/core/scene'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { VertexBuffer } from '@babylonjs/core/Buffers/buffer'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import { applyToon } from './toon-city'

// Bâtiments ordinaires remodelés ; les autres (présidence, marché, hôtel Pilton, enseignes du Njoka…) restent tels quels.
const remodeled = /^(maison_P|maison_p|maison_CM|maison JCD|office|Office|ofiice|bat[ABC]|Avenn|Rich home|WSP (Baies|Cadres) Rich home)/
export const remodeledBuilding = (name: string) => remodeled.test(name)
// Les baies et cadres des « Rich home » disparaissent avec leur maison.
export const remodelDetailOnly = (name: string) => /^WSP (Baies|Cadres) Rich home/.test(name)

const WALLS = ['#d9c9a0', '#c98f6a', '#9fb4c8', '#b9a3c9', '#d6b45e', '#a9c08f', '#e3dccd', '#c7745e', '#8fb3b0', '#e0a96d']
const TINS = ['#8d939c', '#9c7b5c', '#7d8c9c', '#a3a7ad']
const ROOF = '#6f727b', DOOR = '#5a3a24', TANK = '#3f6fa8'

type Builder = { positions: number[]; normals: number[]; colors: number[]; indices: number[] }
const builder = (): Builder => ({ positions: [], normals: [], colors: [], indices: [] })
const rgb = (hex: string, shade = 1) => { const c = Color3.FromHexString(hex); return [c.r * shade, c.g * shade, c.b * shade] }
// Repère local du bâtiment : u le long du grand côté, v en travers, y vers le haut.
type Frame = { cx: number; cz: number; cos: number; sin: number; base: number }
const toWorld = (f: Frame, u: number, y: number, v: number) => new Vector3(f.cx + u * f.cos - v * f.sin, f.base + y, f.cz + u * f.sin + v * f.cos)
// Chaque face est retournée au besoin pour regarder vers l’extérieur de son volume (centre donné).
function quad(b: Builder, a: Vector3, c: Vector3, d: Vector3, e: Vector3, color: number[], center?: Vector3) {
  let n = Vector3.Cross(d.subtract(a), c.subtract(a)).normalize(), order = [a, c, d, e]
  if (center && Vector3.Dot(n, a.add(c).add(d).add(e).scale(.25).subtract(center)) < 0) { n = n.scale(-1); order = [a, e, d, c] }
  const start = b.positions.length / 3
  for (const p of order) { b.positions.push(p.x, p.y, p.z); b.normals.push(n.x, n.y, n.z); b.colors.push(color[0]!, color[1]!, color[2]!, 1) }
  b.indices.push(start, start + 1, start + 2, start, start + 2, start + 3)
}
// Pavé défini par ses 8 coins (bas : 0-3, haut : 4-7, dans le même ordre).
function cuboid(b: Builder, p: Vector3[], color: number[], sides = true) {
  const center = p.reduce((sum, point) => sum.addInPlace(point), Vector3.Zero()).scale(1 / p.length)
  quad(b, p[4]!, p[5]!, p[6]!, p[7]!, color, center)
  quad(b, p[3]!, p[2]!, p[1]!, p[0]!, color.map(c => c * .7), center)
  if (!sides) return
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; quad(b, p[i]!, p[j]!, p[j + 4]!, p[i + 4]!, color.map(c => c * (i % 2 ? .9 : .82)), center) }
}
function box(b: Builder, f: Frame, u0: number, u1: number, y0: number, y1: number, v0: number, v1: number, color: number[]) {
  const corners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]
  cuboid(b, [...corners.map(([u, v]) => toWorld(f, u!, y0, v!)), ...corners.map(([u, v]) => toWorld(f, u!, y1, v!))], color)
}
function cylinder(b: Builder, f: Frame, u: number, v: number, y0: number, y1: number, radius: number, color: number[], sides = 8) {
  const ring = (y: number) => Array.from({ length: sides }, (_, k) => { const a = k / sides * Math.PI * 2; return toWorld(f, u + Math.cos(a) * radius, y, v + Math.sin(a) * radius) })
  const low = ring(y0), high = ring(y1), center = toWorld(f, u, (y0 + y1) / 2, v)
  for (let k = 0; k < sides; k++) { const j = (k + 1) % sides; quad(b, low[k]!, low[j]!, high[j]!, high[k]!, color.map(c => c * (k % 2 ? .92 : 1)), center) }
  for (let k = 1; k < sides - 1; k++) { const start = b.positions.length / 3; for (const p of [high[0]!, high[k + 1]!, high[k]!]) { b.positions.push(p.x, p.y, p.z); b.normals.push(0, 1, 0); b.colors.push(color[0]!, color[1]!, color[2]!, 1) } b.indices.push(start, start + 1, start + 2) }
}
// Pan de tôle ondulée : bandes alternées claires et sombres, de l'égout jusqu'au faîtage.
function tinSlope(b: Builder, f: Frame, u0: number, u1: number, eave: [number, number], ridge: [number, number], color: string) {
  const strips = Math.max(4, Math.round((u1 - u0) / .7))
  for (let k = 0; k < strips; k++) {
    const a = u0 + (u1 - u0) * k / strips, c = u0 + (u1 - u0) * (k + 1) / strips, shade = k % 2 ? .82 : 1.04, t = .08
    const corners = (lift: number) => [toWorld(f, a, eave[0] + lift, eave[1]), toWorld(f, c, eave[0] + lift, eave[1]), toWorld(f, c, ridge[0] + lift, ridge[1]), toWorld(f, a, ridge[0] + lift, ridge[1])]
    cuboid(b, [...corners(0), ...corners(t)], rgb(color, shade), false)
  }
}
// Fenêtres d'une façade : les allumées et les éteintes vont dans deux maillages (la nuit, seules certaines brillent).
function windowsOnFace(win: Builder[], f: Frame, along: [number, number], fixed: number, axis: 'u' | 'v', floors: number, floorHeight: number, firstY: number, seed: number) {
  const span = along[1] - along[0], count = Math.max(1, Math.floor(span / 2.3)), step = span / count, w = Math.min(1.1, step * .55), h = Math.min(1.3, floorHeight * .45)
  for (let floor = 0; floor < floors; floor++) for (let k = 0; k < count; k++) {
    const mid = along[0] + step * (k + .5), y = firstY + floor * floorHeight, lit = ((seed + floor * 7 + k * 13) % 5) < 2
    const out = fixed > 0 ? .06 : -.06
    if (axis === 'u') box(win[lit ? 0 : 1]!, f, mid - w / 2, mid + w / 2, y, y + h, Math.min(fixed, fixed + out), Math.max(fixed, fixed + out), [1, 1, 1])
    else box(win[lit ? 0 : 1]!, f, Math.min(fixed, fixed + out), Math.max(fixed, fixed + out), y, y + h, mid - w / 2, mid + w / 2, [1, 1, 1])
  }
}

// Emprise orientée par analyse en composantes principales des sommets (plan horizontal).
function footprint(mesh: Mesh) {
  const data = mesh.getVerticesData(VertexBuffer.PositionKind)!, world = mesh.getWorldMatrix(), points: Vector3[] = []
  for (let i = 0; i < data.length; i += 3) points.push(Vector3.TransformCoordinates(new Vector3(data[i], data[i + 1], data[i + 2]), world))
  let mx = 0, mz = 0, minY = Infinity, maxY = -Infinity
  for (const p of points) { mx += p.x; mz += p.z; minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y) }
  mx /= points.length; mz /= points.length
  let xx = 0, zz = 0, xz = 0
  for (const p of points) { const dx = p.x - mx, dz = p.z - mz; xx += dx * dx; zz += dz * dz; xz += dx * dz }
  const angle = .5 * Math.atan2(2 * xz, xx - zz), cos = Math.cos(angle), sin = Math.sin(angle)
  let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity
  for (const p of points) { const dx = p.x - mx, dz = p.z - mz, u = dx * cos + dz * sin, v = -dx * sin + dz * cos; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v) }
  const cu = (u0 + u1) / 2, cv = (v0 + v1) / 2
  const frame: Frame = { cx: mx + cu * cos - cv * sin, cz: mz + cu * sin + cv * cos, cos, sin, base: minY }
  return { frame, length: u1 - u0, width: v1 - v0, height: maxY - minY }
}
const hash = (text: string) => { let h = 7; for (const c of text) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h }

export function createBuildingKit(scene: Scene) {
  const wall = new StandardMaterial('Bâtiments MVP', scene); wall.specularColor = Color3.Black(); wall.diffuseColor = new Color3(1.15, 1.15, 1.15); applyToon(wall); wall.backFaceCulling = false
  const glass = new StandardMaterial('Fenêtres MVP', scene); glass.specularColor = Color3.Black(); glass.diffuseColor = Color3.FromHexString('#3b4d6e'); applyToon(glass); glass.backFaceCulling = false
  const lit = new StandardMaterial('Fenêtres allumées MVP', scene); lit.specularColor = Color3.Black(); lit.diffuseColor = Color3.FromHexString('#3b4d6e'); applyToon(lit); lit.backFaceCulling = false
  // Remplace un bâtiment par sa version remodelée (maillages à intégrer aux lots de la ville).
  function remodel(mesh: Mesh): Mesh[] {
    const { frame: f, length, width, height } = footprint(mesh), seed = hash(mesh.name + mesh.uniqueId)
    const body = builder(), win = [builder(), builder()]
    const L = length / 2 * .96, W = width / 2 * .96, wallColor = rgb(WALLS[seed % WALLS.length]!)
    if (height < 5.6) {
      // Case : murs, porte, petites fenêtres, toit de tôle (un pan pour les bidonvilles, deux pour les maisons).
      const wallTop = Math.max(2.2, height * .68), shanty = /^maison_[Pp]/.test(mesh.name), tin = TINS[seed % TINS.length]!
      box(body, f, -L, L, 0, wallTop, -W, W, wallColor)
      box(body, f, -.45, .45, 0, Math.min(1.9, wallTop * .8), W, W + .05, rgb(DOOR))
      windowsOnFace(win, f, [-L * .9, L * .9], -W, 'u', 1, 1, wallTop * .42, seed)
      const over = .35
      if (shanty) tinSlope(body, f, -L - over, L + over, [wallTop, W + over], [wallTop + Math.min(1.1, width * .18), -W - over], tin)
      else { const ridge = wallTop + Math.min(1.8, width * .3); tinSlope(body, f, -L - over, L + over, [wallTop, W + over], [ridge, 0], tin); tinSlope(body, f, -L - over, L + over, [wallTop, -W - over], [ridge, 0], tin) }
    } else {
      // Immeuble : corps, bandeaux d'étage, fenêtres sur les quatre faces, balcons, acrotère et château d'eau.
      const floors = Math.max(2, Math.round(height / 3.1)), floorHeight = height / floors
      box(body, f, -L, L, 0, height, -W, W, wallColor)
      for (let k = 1; k < floors; k++) box(body, f, -L - .08, L + .08, k * floorHeight - .1, k * floorHeight + .1, -W - .08, W + .08, rgb(WALLS[(seed + 3) % WALLS.length]!, .8))
      box(body, f, -1, 1, 0, Math.min(2.6, floorHeight * .85), W, W + .06, rgb(DOOR))
      windowsOnFace(win, f, [-L * .92, L * .92], W, 'u', floors - 1, floorHeight, floorHeight * 1.35, seed)
      windowsOnFace(win, f, [-L * .92, L * .92], -W, 'u', floors, floorHeight, floorHeight * .35, seed + 1)
      windowsOnFace(win, f, [-W * .9, W * .9], L, 'v', floors, floorHeight, floorHeight * .35, seed + 2)
      windowsOnFace(win, f, [-W * .9, W * .9], -L, 'v', floors, floorHeight, floorHeight * .35, seed + 3)
      if (seed % 3 !== 0) for (let k = 1; k < floors; k += 2) box(body, f, -L * .6, L * .6, k * floorHeight, k * floorHeight + .18, W, W + 1.1, rgb(ROOF))
      const parapet = .7, t = .25
      box(body, f, -L, L, height, height + parapet, -W, -W + t, rgb(ROOF)); box(body, f, -L, L, height, height + parapet, W - t, W, rgb(ROOF))
      box(body, f, -L, -L + t, height, height + parapet, -W, W, rgb(ROOF)); box(body, f, L - t, L, height, height + parapet, -W, W, rgb(ROOF))
      cylinder(body, f, L * .45, -W * .3, height, height + 2.4, Math.min(1.3, W * .3), rgb(TANK))
    }
    const make = (name: string, b: Builder, material: StandardMaterial) => {
      if (!b.indices.length) return null
      const data = new VertexData(); data.positions = b.positions; data.normals = b.normals; data.indices = b.indices; data.colors = b.colors
      const result = new Mesh(name, scene); data.applyToMesh(result); result.material = material; result.isPickable = false; return result
    }
    return [make(mesh.name + ' (MVP)', body, wall), make(mesh.name + ' · fenêtres allumées', win[0]!, lit), make(mesh.name + ' · fenêtres', win[1]!, glass)].filter((m): m is Mesh => !!m)
  }
  // Le soir, une fenêtre sur trois environ s'allume en jaune, comme dans l'ancien jeu.
  function setEvening(value: boolean) { lit.emissiveColor = value ? new Color3(1, .82, .38) : Color3.Black(); lit.diffuseColor = value ? new Color3(1, .86, .45) : Color3.FromHexString('#3b4d6e') }
  return { remodel, setEvening }
}
