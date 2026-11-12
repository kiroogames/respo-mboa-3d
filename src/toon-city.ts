/*
 * Rendu cartoon de la ville : couleurs plus franches, lumière en aplats et contour encré.
 * Formes et textures ne changent pas : tout se joue au rendu. L'eau garde son animation, sans ce style.
 */
import { MaterialPluginBase } from '@babylonjs/core/Materials/materialPluginBase'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color'
import { RegisterClass } from '@babylonjs/core/Misc/typeStore'
import type { Material } from '@babylonjs/core/Materials/material'
import type { Mesh } from '@babylonjs/core/Meshes/mesh'
import '@babylonjs/core/Rendering/edgesRenderer'
import '@babylonjs/core/Rendering/outlineRenderer'

const plain = /^(WSP (Eau turquoise|Mer vivante)|Outline|Verre des)/
// Pas de contour sur ce qui est posé à plat ou très fin : il ne dessinerait que des traits parasites.
const noInk = /^(bg\.|Sol peint|Outline|Verre|Bronze|WSP (Prairie|Eau|Mer|Terre des abords|Route|Bordures|Fils|Haubans|Surface|Socle|Tablier|Rustines|Trous|Ligne|Gazon|Terre du pont|Herbe du pont|Feuillage|Jardins))/

export const isCartoonMaterial = (name: string) => !plain.test(name)
export const wantsInk = (name: string) => !noInk.test(name)

class ToonPlugin extends MaterialPluginBase {
  constructor(material: Material) { super(material, 'ToonVille', 200); this._enable(true) }
  override getClassName() { return 'ToonPlugin' }
  override isCompatible() { return true }
  override getCustomCode(shaderType: string) {
    if (shaderType !== 'fragment') return null
    return {
      // Teintes plus vives et paliers légers : plus forts, ils font des bandes sur les dégradés des toits.
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
        float toonGrey=dot(baseColor.rgb,vec3(.299,.587,.114));
        baseColor.rgb=clamp(mix(vec3(toonGrey),baseColor.rgb,1.35),0.,1.);
        baseColor.rgb=mix(baseColor.rgb,floor(baseColor.rgb*12.+.5)/12.,.25);`,
      // Lumière en trois paliers : plein jour, côté ombré, ombre portée.
      CUSTOM_FRAGMENT_BEFORE_FOG: `
        float toonBase=max(dot(baseColor.rgb*vDiffuseColor.rgb,vec3(.299,.587,.114)),.02);
        float toonLight=dot(color.rgb,vec3(.299,.587,.114))/toonBase;
        float toonStep=toonLight<.62?.52:toonLight<.92?.78:1.08;
        color.rgb*=mix(1.,toonStep/max(toonLight,.02),.8);`,
    }
  }
}

// Le clonage d'une matière recrée ses réglages par leur nom de classe.
RegisterClass('BABYLON.ToonPlugin', ToonPlugin)

export function applyToon(material: Material) { if (!material.pluginManager?.getPlugin('ToonVille')) new ToonPlugin(material) }

// Contour : seulement sur les arêtes franches, pour ne pas hachurer les formes arrondies.
export function inkEdges(mesh: Mesh) {
  mesh.enableEdgesRendering(.92)
  mesh.edgesWidth = 5
  mesh.edgesColor = new Color4(.13, .09, .07, 1)
}

// Style de l'ancien jeu (MVP Responsable) pour les bâtiments, sans toucher à leurs formes :
// textures simplifiées en aplats, traits d'arêtes plus épais et contour noir autour de la silhouette.
class MvpStylePlugin extends MaterialPluginBase {
  constructor(material: Material) { super(material, 'StyleMVP', 210); this._enable(true) }
  override getClassName() { return 'MvpStylePlugin' }
  override isCompatible() { return true }
  override getCustomCode(shaderType: string) {
    if (shaderType !== 'fragment') return null
    return {
      // Aplats : la couleur peinte est ramenée à quelques niveaux, les détails (fenêtres, enseignes) restent lisibles.
      CUSTOM_FRAGMENT_UPDATE_DIFFUSE: `
        vec3 mvpFlat=floor(baseColor.rgb*5.+.5)/5.;
        baseColor.rgb=mix(baseColor.rgb,mvpFlat,.6);`,
    }
  }
}
RegisterClass('BABYLON.MvpStylePlugin', MvpStylePlugin)
const notBuilding = /Arbre|Arbuste|Tronc|Feuillage|Couronne|banc|Lampadaire|Lanterne|Bordure|N116|^taxi$|WSP Vehicule|Mat3D_police|Avion|Garde corps|Bois des poteaux|Transformateurs|pont|Passant|Panneau|Assise|Statue|statue/
export const isBuildingGroup = (name: string) => !notBuilding.test(name)
export function applyMvpStyle(mesh: Mesh) {
  if (mesh.material && !mesh.material.pluginManager?.getPlugin('StyleMVP')) new MvpStylePlugin(mesh.material)
  mesh.edgesWidth = 8
  mesh.edgesColor = new Color4(.07, .05, .05, 1)
  mesh.renderOutline = true
  mesh.outlineColor = new Color3(.07, .05, .05)
  mesh.outlineWidth = .07
}
