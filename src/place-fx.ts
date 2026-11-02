/*
 * Retour sur la carte après une action : quand une fenêtre se ferme après un changement de ressources,
 * un anneau et des éclats partent du lieu, et son nom rebondit. Purement visuel, aucune règle de jeu.
 */
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial'
import { Color3 } from '@babylonjs/core/Maths/math.color'
import { Vector3 } from '@babylonjs/core/Maths/math.vector'
import type { Scene } from '@babylonjs/core/scene'
import { getMoneyBalance, onMoneyBalanceChange } from './currency'
import { getPlayerResources, onPlayerResourcesChange } from './player-resources'
import './place-fx.css'

const SPARKS = 14, DURATION = 1.15

export function mountPlaceFx(scene: Scene, options: { zone: () => string; point: (zone: string) => Vector3; travelling: () => boolean }) {
  const ringMaterial = new StandardMaterial('Anneau du lieu', scene), sparkMaterial = new StandardMaterial('Éclats du lieu', scene)
  for (const m of [ringMaterial, sparkMaterial]) { m.disableLighting = true; m.specularColor = Color3.Black(); m.backFaceCulling = false }
  const ring = MeshBuilder.CreateTorus('Anneau du lieu', { diameter: 2, thickness: .09, tessellation: 40 }, scene)
  ring.material = ringMaterial; ring.isPickable = false; ring.setEnabled(false)
  const sparks = Array.from({ length: SPARKS }, (_, i) => {
    const spark = MeshBuilder.CreateBox('Éclat', { size: .55 }, scene)
    spark.material = sparkMaterial; spark.isPickable = false; spark.setEnabled(false); spark.rotation.set(.6, i, .4)
    return spark
  })
  let money = getMoneyBalance(), mood = getPlayerResources().mood, energy = getPlayerResources().energy
  let pending: boolean | null = null, playing = 0, origin = Vector3.Zero(), gain = true
  // Seule une action faite dans une fenêtre compte : le temps qui passe et les trajets ne déclenchent rien.
  function changed() {
    const r = getPlayerResources(), next = getMoneyBalance()
    const up = next > money || r.mood > mood || r.energy > energy, moved = next !== money || r.mood !== mood || r.energy !== energy
    money = next; mood = r.mood; energy = r.energy
    if (moved && !options.travelling() && document.querySelector('dialog[open]')) pending = (pending ?? false) || up
  }
  onMoneyBalanceChange(changed); onPlayerResourcesChange(changed)

  function start(positive: boolean) {
    const zone = options.zone()
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
    origin = options.point(zone); gain = positive; playing = DURATION
    const color = positive ? new Color3(1, .78, .22) : new Color3(.45, .78, .95)
    ringMaterial.emissiveColor = color; sparkMaterial.emissiveColor = color
    ring.setEnabled(true); ring.position.copyFrom(origin)
    sparks.forEach(spark => spark.setEnabled(true))
    const label = document.querySelector<HTMLElement>(`#landmarks .landmark[data-view="${zone}"]`)
    if (label) { label.classList.remove('place-fx-pop'); void label.offsetWidth; label.classList.add('place-fx-pop') }
  }
  scene.onBeforeRenderObservable.add(() => {
    if (pending !== null && !document.querySelector('dialog[open]') && !options.travelling()) { start(pending); pending = null }
    if (playing <= 0) return
    playing -= Math.min(scene.getEngine().getDeltaTime(), 50) / 1000
    if (playing <= 0) { ring.setEnabled(false); sparks.forEach(spark => spark.setEnabled(false)); return }
    const t = 1 - playing / DURATION, out = 1 - (1 - t) * (1 - t)
    ring.scaling.setAll(3 + out * 19); ring.scaling.y = 1
    ringMaterial.alpha = 1 - t
    sparkMaterial.alpha = 1 - t * t
    sparks.forEach((spark, i) => {
      const angle = i / SPARKS * Math.PI * 2, reach = 3 + out * (9 + (i % 4) * 2.5)
      spark.position.set(origin.x + Math.cos(angle) * reach, origin.y + .5 + (gain ? 1 : .4) * (out * (9 + (i % 3) * 3) - t * t * 5), origin.z + Math.sin(angle) * reach)
      spark.rotation.y += .12
    })
  })
}
