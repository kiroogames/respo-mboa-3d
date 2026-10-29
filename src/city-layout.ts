/*
 * Conversion des positions vers la carte élargie : seuls X et Z sont multipliés.
 * La hauteur Y garde son échelle pour éviter de déformer le relief et les bâtiments.
 */

import settings from '../city-layout.json'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'

export const cityScale = settings.horizontalScale

export function cityPosition(position: Vector3) {
  return new Vector3(position.x * cityScale, position.y, position.z * cityScale)
}
