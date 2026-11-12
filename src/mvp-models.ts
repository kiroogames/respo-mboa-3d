/*
 * Personnages et véhicules repris de l'ancien jeu « MVP Responsable » (public/models/mvp/).
 * Les deux fichiers sont lus directement, sans chargeur glTF : ce sont des pièces rigides, colorées pièce par pièce.
 * - chibi.glb : un personnage à 9 os ; chaque vêtement est une pièce accrochée à un os ; animation « walk ».
 * - citykit.glb : véhicules (taxi, berline, pick-up, minibus, moto + conducteur…) ; le nom de chaque pièce donne
 *   son rôle et sa couleur : « veh_taxi.p.f2c230 » = pièce de carrosserie (p, repeinte par véhicule), couleur f2c230.
 * Pour rester léger, chaque type de passant ou de véhicule est un maillage maître caché, dupliqué par instances.
 */
import type { Scene } from '@babylonjs/core/scene'
import { Mesh } from '@babylonjs/core/Meshes/mesh'
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode'
import type { InstancedMesh } from '@babylonjs/core/Meshes/instancedMesh'
import '@babylonjs/core/Meshes/instancedMesh'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { Matrix, Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector'
import { applyToon, inkEdges } from './toon-city'

// Échelle réelle commune : le kit de l’ancien jeu est en mètres (berline 3,8 m, moto 1,84 m, minibus 4,56 m).
// 1 m = 0,858 unité de la ville, calé sur la taille actuelle des taxis ; les passants (1,75 m) suivent la même échelle,
// pour que personnes et véhicules gardent leurs proportions réelles.
export const kitWorldScale = .858
export const personHeight = 1.75

// ---------------------------------------------------------------- lecture GLB
type Glb = { json: any; buffer: ArrayBuffer; bin: number }
function readGlb(buffer: ArrayBuffer): Glb {
  const length = new DataView(buffer).getUint32(12, true)
  return { json: JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, length))), buffer, bin: 20 + length + 8 }
}
function accessor(glb: Glb, index: number) {
  const a = glb.json.accessors[index], view = glb.json.bufferViews[a.bufferView]
  const size = ({ SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 } as Record<string, number>)[a.type]!
  const Type = a.componentType === 5126 ? Float32Array : a.componentType === 5125 ? Uint32Array : a.componentType === 5123 ? Uint16Array : Uint8Array
  const offset = glb.bin + (view.byteOffset ?? 0) + (a.byteOffset ?? 0)
  return new Type(glb.buffer.slice(offset, offset + a.count * size * Type.BYTES_PER_ELEMENT))
}
// Passage au repère de Babylon par miroir sur un axe (0 = X pour les personnages, 2 = Z pour les véhicules,
// qui regardent alors vers −Z comme la circulation actuelle).
function mirrorT(t: number[] | undefined, axis: number) { const v = t ? [...t] : [0, 0, 0]; v[axis] = -v[axis]!; return new Vector3(v[0], v[1], v[2]) }
function mirrorR(r: number[] | undefined, axis: number) { if (!r) return Quaternion.Identity(); const q = r.map((v, i) => i === axis || i === 3 ? v : -v); return new Quaternion(q[0], q[1], q[2], q[3]) }
type Geometry = { positions: number[]; normals: number[]; indices: number[] }
function meshGeometry(glb: Glb, mesh: number, axis: number, transform?: Matrix): Geometry {
  const primitive = glb.json.meshes[mesh].primitives[0]
  const p = accessor(glb, primitive.attributes.POSITION), n = accessor(glb, primitive.attributes.NORMAL), ix = accessor(glb, primitive.indices)
  const positions: number[] = [], normals: number[] = [], indices: number[] = []
  const point = new Vector3(), normal = new Vector3()
  for (let k = 0; k < p.length; k += 3) {
    point.set(p[k]!, p[k + 1]!, p[k + 2]!); normal.set(n[k]!, n[k + 1]!, n[k + 2]!)
    if (axis === 0) { point.x = -point.x; normal.x = -normal.x } else { point.z = -point.z; normal.z = -normal.z }
    if (transform) { Vector3.TransformCoordinatesToRef(point, transform, point); Vector3.TransformNormalToRef(normal, transform, normal); normal.normalize() }
    positions.push(point.x, point.y, point.z); normals.push(normal.x, normal.y, normal.z)
  }
  // Le miroir inverse le sens des triangles.
  for (let k = 0; k < ix.length; k += 3) indices.push(ix[k]!, ix[k + 2]!, ix[k + 1]!)
  return { positions, normals, indices }
}
function hex(color: string) { return Color3.FromHexString(color.startsWith('#') ? color : '#' + color) }
// Assemble des pièces en un maillage coloré par sommet (ou sans couleur pour la carrosserie repeinte).
function buildMesh(name: string, scene: Scene, pieces: { geometry: Geometry; color?: Color3 }[], material: StandardMaterial) {
  const data = new VertexData(), positions: number[] = [], normals: number[] = [], indices: number[] = [], colors: number[] = []
  const withColors = pieces.some(piece => piece.color)
  for (const { geometry, color } of pieces) {
    const offset = positions.length / 3
    positions.push(...geometry.positions); normals.push(...geometry.normals); indices.push(...geometry.indices.map(i => i + offset))
    if (withColors) for (let k = 0; k < geometry.positions.length / 3; k++) colors.push(color?.r ?? 1, color?.g ?? 1, color?.b ?? 1, 1)
  }
  data.positions = positions; data.normals = normals; data.indices = indices; if (withColors) data.colors = colors
  const mesh = new Mesh(name, scene); data.applyToMesh(mesh); mesh.material = material
  mesh.isPickable = false; mesh.isVisible = false
  return mesh
}
function toonMaterial(name: string, scene: Scene) {
  // Couleurs de l’ancien jeu calibrées pour son propre éclairage : éclaircies pour la lumière de Mboa.
  const material = new StandardMaterial(name, scene); material.specularColor = Color3.Black(); material.diffuseColor = new Color3(1.45, 1.45, 1.45); applyToon(material); return material
}

// ---------------------------------------------------------------- véhicules
export type KitVehicle = { kind: string; body: Mesh; paint: Mesh | null; length: number }
export function buildKitVehicles(buffer: ArrayBuffer, scene: Scene, kinds: string[]) {
  const glb = readGlb(buffer), bodyMaterial = toonMaterial('Véhicules MVP', scene), paintMaterial = toonMaterial('Carrosserie MVP', scene)
  const vehicles = new Map<string, KitVehicle>()
  for (const kind of kinds) {
    const body: { geometry: Geometry; color?: Color3 }[] = [], paint: { geometry: Geometry }[] = []
    let minZ = Infinity, maxZ = -Infinity
    glb.json.nodes.forEach((node: any) => {
      if (node.mesh === undefined) return
      const name: string = glb.json.meshes[node.mesh].name
      const [group, role, color] = name.split('.')
      // La moto emporte son conducteur.
      if (group !== 'veh_' + kind && !(kind === 'moto' && group === 'rider')) return
      const transform = Matrix.Compose(new Vector3(...(node.scale ?? [1, 1, 1]) as [number, number, number]), mirrorR(node.rotation, 2), mirrorT(node.translation, 2))
      const geometry = meshGeometry(glb, node.mesh, 2, transform)
      for (let k = 2; k < geometry.positions.length; k += 3) { minZ = Math.min(minZ, geometry.positions[k]!); maxZ = Math.max(maxZ, geometry.positions[k]!) }
      if (role === 'p' && group !== 'rider') paint.push({ geometry })
      else body.push({ geometry, color: hex(color ?? 'cccccc') })
    })
    if (!body.length) continue
    const bodyMesh = buildMesh('Véhicule MVP ' + kind, scene, body, bodyMaterial)
    inkEdges(bodyMesh); bodyMesh.edgesShareWithInstances = true
    let paintMesh: Mesh | null = null
    if (paint.length) {
      paintMesh = buildMesh('Carrosserie MVP ' + kind, scene, paint, paintMaterial)
      // Couleur propre à chaque instance (taxi jaune, berline rouge…).
      paintMesh.registerInstancedBuffer('color', 4); paintMesh.instancedBuffers.color = new Color4(1, 1, 1, 1)
      inkEdges(paintMesh); paintMesh.edgesShareWithInstances = true
    }
    vehicles.set(kind, { kind, body: bodyMesh, paint: paintMesh, length: maxZ - minZ })
  }
  return vehicles
}
export function placeKitVehicle(vehicle: KitVehicle, parent: TransformNode, scale: number, paint: string) {
  const parts: InstancedMesh[] = []
  const body = vehicle.body.createInstance(vehicle.body.name + ' ·'); body.parent = parent; body.scaling.setAll(scale); parts.push(body)
  if (vehicle.paint) {
    const coat = vehicle.paint.createInstance(vehicle.paint.name + ' ·'); coat.parent = parent; coat.scaling.setAll(scale)
    const color = hex(paint); coat.instancedBuffers.color = new Color4(color.r, color.g, color.b, 1); parts.push(coat)
  }
  return parts
}

// ---------------------------------------------------------------- personnages
const TOPS: Record<string, string[]> = {
  tee: ['shirt_torso', 'shirt_armL', 'shirt_armR'],
  polo: ['shirt_torso', 'shirt_armL', 'shirt_armR', 'trim_collar'],
  shirtTie: ['shirt_torso', 'shirt_armL', 'shirt_armR', 'trim_collar', 'tie_main'],
  suit: ['jacket_torso', 'jacket_armL', 'jacket_armR', 'shirt_front', 'lapel_main', 'tie_main'],
  dashiki: ['tunic_dashiki', 'shirt_armL', 'shirt_armR', 'trim_dashiki'],
  boubou: ['robe_long', 'robe_sleeveL', 'robe_sleeveR', 'trim_neck'],
  kaba: ['robe_kaba', 'robe_puffL', 'robe_puffR', 'shirt_armL', 'shirt_armR'],
}
const BOTTOMS: Record<string, string[]> = {
  pants: ['pants_legL', 'pants_legR'],
  shorts: ['pants_shortL', 'pants_shortR', 'skin_shinL', 'skin_shinR'],
  pagne: ['skirt_pagne', 'skin_shinL', 'skin_shinR'],
  pencil: ['skirt_pencil', 'skin_shinL', 'skin_shinR'],
  mini: ['skirt_dress', 'pants_legL', 'pants_legR'],
  legs: ['skin_shinL', 'skin_shinR'],
}
type Look = { top: string; bottom: string; hair: string; skin: string; shoes: string; shoeColor: string; colors: Record<string, string>; head?: [string, string] }
// Passants de Mboa : tenues du quotidien, wax, dashiki, kaba, boubou, maillot, chemise-cravate (couleurs de l'ancien jeu).
const LOOKS: Look[] = [
  { top: 'tee', bottom: 'pants', hair: 'short', skin: '#6b3f26', shoes: 'sneaker', shoeColor: '#f0f0f0', colors: { shirt: '#e0603a', pants: '#1d2f6a' } },
  { top: 'polo', bottom: 'pagne', hair: 'braids', skin: '#8d5a3a', shoes: 'sandal', shoeColor: '#8a5a30', colors: { shirt: '#e0b020', trim: '#1a1a1a', skirt: '#1e7a3a' } },
  { top: 'dashiki', bottom: 'pants', hair: 'fade', skin: '#5a3420', shoes: 'sandal', shoeColor: '#5a3018', colors: { shirt: '#2a9a6a', trim: '#ffd23f', pants: '#2a9a6a' } },
  { top: 'kaba', bottom: 'legs', hair: 'puff', skin: '#7a4a2f', shoes: 'sandal', shoeColor: '#c9a040', colors: { robe: '#7a2a8a', shirt: '#7a2a8a' }, head: ['gele', '#ffb020'] },
  { top: 'shirtTie', bottom: 'pants', hair: 'short', skin: '#8d5a3a', shoes: 'boots', shoeColor: '#2a1a10', colors: { shirt: '#e8f0fa', trim: '#e8f0fa', tie: '#8a1e2e', pants: '#2a3040' } },
  { top: 'tee', bottom: 'shorts', hair: 'locks', skin: '#4a2c1a', shoes: 'sneaker', shoeColor: '#f0f0f0', colors: { shirt: '#1e9a4a', pants: '#1e9a4a' } },
  { top: 'boubou', bottom: 'pants', hair: 'short', skin: '#6b3f26', shoes: 'sandal', shoeColor: '#f2ead8', colors: { robe: '#3a6ad8', trim: '#e8c050', pants: '#3a6ad8' }, head: ['kufi', '#e0603a'] },
  { top: 'polo', bottom: 'mini', hair: 'twist', skin: '#8d5a3a', shoes: 'sneaker', shoeColor: '#ff3d8b', colors: { shirt: '#1fb5c9', trim: '#1fb5c9', skirt: '#ffe040', pants: '#2a2a2a' } },
  { top: 'suit', bottom: 'pants', hair: 'fade', skin: '#5a3420', shoes: 'boots', shoeColor: '#1a1a1a', colors: { jacket: '#2a3a5a', lapel: '#1e2a44', shirt: '#ffffff', tie: '#c0392b', pants: '#2a3a5a' } },
]
function partColor(part: string, look: Look) {
  const role = part.split('_')[0]!, c = look.colors
  if (role === 'skin') return look.skin
  if (role === 'hair') return '#151515'
  if (role === 'eye') return '#141414'
  if (role === 'white') return '#ffffff'
  if (role === 'mouth') return '#6a1e22'
  if (role === 'shoes') return look.shoeColor
  if (role === 'acc') return look.head?.[1] ?? '#d4af37'
  if (role === 'tunic') return c.tunic ?? c.shirt ?? '#e0603a'
  if (role === 'cape') return c.cape ?? c.robe ?? '#3a6ad8'
  if (role === 'robe') return c.robe ?? c.shirt ?? '#3a6ad8'
  if (role === 'skirt') return c.skirt ?? c.shirt ?? '#e0603a'
  if (role === 'lapel') return c.lapel ?? c.jacket ?? '#1e2a44'
  if (role === 'trim') return c.trim ?? '#d4af37'
  if (role === 'tie') return c.tie ?? '#8a1e2e'
  return c[role] ?? c.shirt ?? '#cccccc'
}
function partsOf(look: Look) {
  const hair = look.head && look.hair !== 'short' && look.hair !== 'fade' ? 'short' : look.hair
  const parts = ['skin_head', 'skin_neck', 'eye_L', 'eye_R', 'white_L', 'white_R', 'hair_brow_L', 'hair_brow_R', 'mouth_jaw', 'skin_handL', 'skin_handR', 'hair_' + hair, ...TOPS[look.top]!, ...BOTTOMS[look.bottom]!, 'shoes_' + look.shoes + '_L', 'shoes_' + look.shoes + '_R']
  if (look.head) parts.push('acc_head_' + look.head[0])
  return parts
}

type Joint = { name: string; parent: number; t: Vector3; r: Quaternion; s: Vector3 }
type Pose = { t?: Vector3; r?: Quaternion; s?: Vector3 }
export type Crowd = ReturnType<typeof buildChibiCrowd>
export function buildChibiCrowd(buffer: ArrayBuffer, scene: Scene, height = personHeight * kitWorldScale) {
  const glb = readGlb(buffer), nodes = glb.json.nodes as any[]
  const parentOf: number[] = nodes.map(() => -1)
  nodes.forEach((node, i) => (node.children ?? []).forEach((child: number) => { parentOf[child] = i }))
  // Os : tous les nœuds sans maillage ; pièces : les maillages, ramenés dans le repère de leur os.
  const jointIndex = new Map<number, number>(), joints: Joint[] = []
  nodes.forEach((node, i) => { if (node.mesh === undefined) { jointIndex.set(i, joints.length); joints.push({ name: node.name, parent: -1, t: mirrorT(node.translation, 0), r: mirrorR(node.rotation, 0), s: new Vector3(...(node.scale ?? [1, 1, 1]) as [number, number, number]) }) } })
  nodes.forEach((_node, i) => { const j = jointIndex.get(i); if (j !== undefined) joints[j]!.parent = jointIndex.get(parentOf[i]!) ?? -1 })
  const parts = new Map<string, { joint: number; geometry: Geometry }>()
  nodes.forEach((node, i) => {
    if (node.mesh === undefined) return
    const transform = Matrix.Compose(new Vector3(...(node.scale ?? [1, 1, 1]) as [number, number, number]), mirrorR(node.rotation, 0), mirrorT(node.translation, 0))
    parts.set(node.name, { joint: jointIndex.get(parentOf[i]!) ?? 0, geometry: meshGeometry(glb, node.mesh, 0, transform) })
  })
  // Marche : 24 poses précalculées par os.
  const frames = 24, walk: Pose[][] = joints.map(() => Array.from({ length: frames }, () => ({})))
  const animation = (glb.json.animations ?? []).find((a: any) => a.name === 'walk')
  if (animation) for (const channel of animation.channels) {
    const joint = jointIndex.get(channel.target.node); if (joint === undefined) continue
    const sampler = animation.samplers[channel.sampler], times = accessor(glb, sampler.input), values = accessor(glb, sampler.output), path = channel.target.path, width = path === 'rotation' ? 4 : 3
    const duration = times[times.length - 1]! || 1
    for (let f = 0; f < frames; f++) {
      const time = f / frames * duration
      let k = 0; while (k < times.length - 2 && times[k + 1]! < time) k++
      const span = (times[k + 1] ?? times[k]!) - times[k]!, mix = span > 0 ? Math.min(1, Math.max(0, (time - times[k]!) / span)) : 0
      const a = Array.from(values.slice(k * width, k * width + width)), b = Array.from(values.slice(Math.min(k + 1, times.length - 1) * width, Math.min(k + 1, times.length - 1) * width + width))
      if (path === 'rotation') walk[joint]![f]!.r = Quaternion.Slerp(mirrorR(a, 0), mirrorR(b, 0), mix)
      else { const v = a.map((x, i) => x + ((b[i] ?? x) - x) * mix); if (path === 'translation') walk[joint]![f]!.t = mirrorT(v, 0); else walk[joint]![f]!.s = new Vector3(v[0], v[1], v[2]) }
    }
  }
  // Hauteur au repos : position monde des sommets les plus hauts (tête, cheveux).
  const world = joints.map(() => Matrix.Identity())
  joints.forEach((joint, i) => { const local = Matrix.Compose(joint.s, joint.r, joint.t); world[i] = joint.parent >= 0 ? local.multiply(world[joint.parent]!) : local })
  let top = 0
  for (const { joint, geometry } of parts.values()) for (let k = 0; k < geometry.positions.length; k += 3) top = Math.max(top, Vector3.TransformCoordinates(new Vector3(geometry.positions[k], geometry.positions[k + 1], geometry.positions[k + 2]), world[joint]!).y)
  const scale = height / (top || 1)
  // Types de passants : pour chaque tenue et chaque os, un maillage maître caché.
  const material = toonMaterial('Passants MVP', scene)
  const types = LOOKS.map((look, k) => {
    const byJoint = new Map<number, { geometry: Geometry; color: Color3 }[]>()
    for (const name of partsOf(look)) { const part = parts.get(name); if (!part) continue; const list = byJoint.get(part.joint) ?? []; list.push({ geometry: part.geometry, color: hex(partColor(name, look)) }); byJoint.set(part.joint, list) }
    return [...byJoint].map(([joint, pieces]) => ({ joint, master: buildMesh(`Passant MVP ${k} · ${joints[joint]!.name}`, scene, pieces, material) }))
  })
  function create(name: string, type: number) {
    const root = new TransformNode(name, scene); root.scaling.setAll(scale)
    const nodes = joints.map(joint => { const node = new TransformNode(name + ' · ' + joint.name, scene); node.position.copyFrom(joint.t); node.rotationQuaternion = joint.r.clone(); node.scaling.copyFrom(joint.s); return node })
    nodes.forEach((node, i) => { node.parent = joints[i]!.parent >= 0 ? nodes[joints[i]!.parent]! : root })
    for (const { joint, master } of types[type % types.length]!) { const instance = master.createInstance(name + ' · ' + master.name); instance.parent = nodes[joint]!; instance.isPickable = false }
    // phase : angle de marche en radians (un tour = un pas complet).
    function pose(phase: number) {
      const f = Math.floor(((phase / (Math.PI * 2)) % 1 + 1) % 1 * frames) % frames
      walk.forEach((poses, i) => { const p = poses[f]!, node = nodes[i]!; if (p.t) node.position.copyFrom(p.t); if (p.r) node.rotationQuaternion!.copyFrom(p.r); if (p.s) node.scaling.copyFrom(p.s) })
    }
    return { root, pose }
  }
  return { create, types: types.length }
}

export async function loadMvpModels(base: string, scene: Scene, vehicleKinds: string[]) {
  const load = async (file: string) => { const response = await fetch(`${base}models/mvp/${file}`); if (!response.ok) throw new Error(file + ' ' + response.status); return response.arrayBuffer() }
  const [chibi, kit] = await Promise.allSettled([load('chibi.glb'), load('citykit.glb')])
  return {
    crowd: chibi.status === 'fulfilled' ? buildChibiCrowd(chibi.value, scene) : null,
    vehicles: kit.status === 'fulfilled' ? buildKitVehicles(kit.value, scene, vehicleKinds) : null,
  }
}
