/* Réseau routier de la circulation : chaussée réellement peinte sur le sol 3D,
   extraite par scripts/extract-road-network.py (coordonnées du monde X, Z),
   avec une grille de hauteurs du sol pour poser les voitures sans calcul au démarrage. */
import network from './data/road-network.json' with { type: 'json' }

export const roadPaths = network.paths as [number, number][][]

const { x0, z0, step, cols, rows, values } = network.heights
const at = (i: number, j: number) => values[Math.max(0, Math.min(rows - 1, i)) * cols + Math.max(0, Math.min(cols - 1, j))]!
// Interpolation bilinéaire de la hauteur du sol, plus un léger décalage pour poser les roues.
export function roadHeight(x: number, z: number) {
  const u = (x - x0) / step, v = (z - z0) / step, j = Math.floor(u), i = Math.floor(v), fu = u - j, fv = v - i
  return at(i, j) * (1 - fu) * (1 - fv) + at(i, j + 1) * fu * (1 - fv) + at(i + 1, j) * (1 - fu) * fv + at(i + 1, j + 1) * fu * fv + .075
}
