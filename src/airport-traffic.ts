/*
 * Rotation des avions de Nsimaport, sans dépendance au moteur 3D : stationnement, roulage, décollage,
 * disparition au loin, approche, atterrissage, retour au stationnement. Le décalage entre avions évite tout croisement.
 */

type P2 = [number, number]
export type PlaneState = { position: [number, number, number]; yaw: number; pitch: number; visible: boolean }

// Piste peinte au sol (monde x, z) et son axe.
const threshold: P2 = [190, -65], axis: P2 = [.876, .482]
export const planeCycle = 108
export const planeOffsets = [0, 25]
// Postes de stationnement, entre le terminal et la piste, et sens du nez à l'arrêt.
const nose: P2 = [.3, .954]
const stands: P2[] = [[161, -80], [185, -100]]
const ROLL = 92, GROUND = .05
// Fin de chaque phase, en secondes dans le cycle.
const PARK = 16, TAXI_OUT = 26, TAKEOFF = 33, CLIMB = 47, AWAY = 61, APPROACH = 75, ROLLOUT = 82, TAXI_BACK = 92

const along = (s: number): P2 => [threshold[0] + axis[0] * s, threshold[1] + axis[1] * s]
const heading = (d: P2) => Math.atan2(-d[0], -d[1])
const ease = (t: number) => t * t * (3 - 2 * t)

function bezier(a: P2, b: P2, c: P2, d: P2, t: number) {
  const u = 1 - t
  const point: P2 = [0, 1].map(i => u * u * u * a[i]! + 3 * u * u * t * b[i]! + 3 * u * t * t * c[i]! + t * t * t * d[i]!) as P2
  const tangent: P2 = [0, 1].map(i => 3 * u * u * (b[i]! - a[i]!) + 6 * u * t * (c[i]! - b[i]!) + 3 * t * t * (d[i]! - c[i]!)) as P2
  return { point, tangent }
}

// Bruit de l'avion, de 0 à 1 : plein gaz au décollage, moteurs retenus à l'atterrissage.
export function planeRoar(seconds: number, index: number) {
  const t = ((seconds + planeOffsets[index]!) % planeCycle + planeCycle) % planeCycle
  if (t >= TAXI_OUT && t < TAKEOFF) return ease((t - TAXI_OUT) / (TAKEOFF - TAXI_OUT))
  if (t >= TAKEOFF && t < CLIMB) return 1 - ease((t - TAKEOFF) / (CLIMB - TAKEOFF))
  if (t >= AWAY + 5 && t < APPROACH) return .55 * ease((t - AWAY - 5) / (APPROACH - AWAY - 5))
  if (t >= APPROACH && t < ROLLOUT) return .55 * (1 - ease((t - APPROACH) / (ROLLOUT - APPROACH)))
  return 0
}

export function planeState(seconds: number, index: number): PlaneState {
  const t = ((seconds + planeOffsets[index]!) % planeCycle + planeCycle) % planeCycle
  const stand = stands[index]!, parked = { position: [stand[0], GROUND, stand[1]] as [number, number, number], yaw: heading(nose), pitch: 0, visible: true }
  const beforeRunway: P2 = [threshold[0] - axis[0] * 14, threshold[1] - axis[1] * 14]
  const standFront: P2 = [stand[0] + nose[0] * 20, stand[1] + nose[1] * 20], standBack: P2 = [stand[0] - nose[0] * 20, stand[1] - nose[1] * 20]
  if (t < PARK || t >= TAXI_BACK) return parked
  if (t < TAXI_OUT) {
    const { point, tangent } = bezier(stand, standFront, beforeRunway, threshold, ease((t - PARK) / (TAXI_OUT - PARK)))
    return { position: [point[0], GROUND, point[1]], yaw: heading(tangent), pitch: 0, visible: true }
  }
  if (t < TAKEOFF) {
    const k = (t - TAXI_OUT) / (TAKEOFF - TAXI_OUT), p = along(ROLL * k * k)
    // Le nez se lève sur la fin de la course.
    return { position: [p[0], GROUND, p[1]], yaw: heading(axis), pitch: .16 * ease(Math.max(0, (k - .78) / .22)), visible: true }
  }
  if (t < CLIMB) {
    const k = t - TAKEOFF, p = along(ROLL + 26.3 * k + .8 * k * k)
    return { position: [p[0], GROUND + 2.2 * k + .16 * k * k, p[1]], yaw: heading(axis), pitch: .16 + .08 * ease(Math.min(1, k / 4)), visible: true }
  }
  if (t < AWAY) return { ...parked, visible: false }
  const back: P2 = [-axis[0], -axis[1]]
  if (t < APPROACH) {
    const k = (t - AWAY) / (APPROACH - AWAY), p = along(560 - (560 - ROLL) * k)
    return { position: [p[0], GROUND + 72 * Math.pow(1 - k, 1.25), p[1]], yaw: heading(back), pitch: .05 + .05 * ease(Math.max(0, (k - .8) / .2)), visible: true }
  }
  if (t < ROLLOUT) {
    const k = (t - APPROACH) / (ROLLOUT - APPROACH), p = along(ROLL * (1 - k) * (1 - k))
    return { position: [p[0], GROUND, p[1]], yaw: heading(back), pitch: .1 * (1 - ease(Math.min(1, k / .2))), visible: true }
  }
  const { point, tangent } = bezier(threshold, beforeRunway, standBack, stand, ease((t - ROLLOUT) / (TAXI_BACK - ROLLOUT)))
  return { position: [point[0], GROUND, point[1]], yaw: heading(tangent), pitch: 0, visible: true }
}
