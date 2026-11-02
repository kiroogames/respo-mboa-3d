/*
 * Rendu cartoon des bâtiments : couleurs plus franches, lumière en aplats et contour encré.
 * Formes et textures ne changent pas : tout se joue au rendu, et seulement sur les matières des bâtiments.
 */
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase'
import { Color4 } from '@babylonjs/core/Maths/math.color'
import type { Material } from '@babylonjs/core/Materials/material'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import '@babylonjs/core/Rendering/edgesRenderer'

// Les matières créées pour le décor portent le préfixe WSP : seules celles des bâtiments comptent.
const madeForBuildings = new Set(['WSP Enduit ivoire', 'WSP Toitures terre cuite', 'WSP Verrieres', 'WSP Fenetres habitees'])
const notBuildings = /^(WSP |bg\.|Outline|taxi|Avion|N116|Panneau|Verre|Material|Viewer|Bronze|WM )/

export const isBuildingMaterial = (name: string) => madeForBuildings.has(name) || !notBuildings.test(name)

class ToonPlugin extends MaterialPluginBase {
  constructor(material: Material) { super(material, 'ToonBatiments', 200); this._enable(true) }
  override getClassName() { return 'ToonPlugin' }
  override isCompatible() { return true }
  override getCustomCode(shaderType: string) {
    if (shaderType !== 'fragment') return null
    return {
      // Teintes plus vives et paliers de couleur, sans effacer le dessin de la texture.
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
        float toonGrey=dot(baseColor.rgb,vec3(.299,.587,.114));
        baseColor.rgb=clamp(mix(vec3(toonGrey),baseColor.rgb,1.35),0.,1.);
        baseColor.rgb=mix(baseColor.rgb,floor(baseColor.rgb*7.+.5)/7.,.55);`,
      // Lumière en trois paliers : plein jour, côté ombré, ombre portée.
      CUSTOM_FRAGMENT_BEFORE_FOG: `
        float toonBase=max(dot(baseColor.rgb,vec3(.299,.587,.114)),.02);
        float toonLight=dot(color.rgb,vec3(.299,.587,.114))/toonBase;
        float toonStep=toonLight<.62?.52:toonLight<.92?.78:1.08;
        color.rgb*=mix(1.,toonStep/max(toonLight,.02),.8);`,
    }
  }
}

export function applyToon(material: Material) { new ToonPlugin(material) }

// Contour : seulement sur les arêtes franches, pour ne pas hachurer les formes arrondies.
export function inkEdges(mesh: Mesh) {
  mesh.enableEdgesRendering(.92)
  mesh.edgesWidth = 5
  mesh.edgesColor = new Color4(.13, .09, .07, 1)
}
