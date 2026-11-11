/*
 * Kit d'interface peint (voir art/kit-interface.md) : chaque pièce déposée dans public/ui/kit/ est adoptée
 * au chargement, sans toucher au code. Une pièce absente laisse simplement l'apparence actuelle.
 */
const icons = ['meal', 'transport', 'dossier', 'sleep', 'bills', 'energy', 'mood', 'tontine', 'ceremony', 'savings', 'level']
const pieces = ['panel', 'plaque', 'button-primary', 'button-secondary', 'card', 'hud', 'close', ...icons.map(name => `icon-${name}`)]
const ready = new Set<string>()
// Les images restent référencées : le navigateur les garde décodées, sans clignotement à la première fenêtre.
const loaded: HTMLImageElement[] = []
// Adresse absolue : une adresse relative placée dans une variable CSS serait résolue depuis le dossier de la feuille de style (assets/).
export const kitUrl = (name: string) => new URL(`${import.meta.env.BASE_URL}ui/kit/${name}.png`, document.baseURI).href
export const kitHas = (name: string) => ready.has(name)
export const kitCount = () => ready.size

export function mountUiKit() {
  const root = document.documentElement
  for (const name of pieces) {
    const image = new Image()
    // La classe active les règles de menus-arcade.css ; la variable porte l'adresse, valable aussi sous un sous-dossier.
    image.onload = () => { ready.add(name); root.style.setProperty(`--kit-${name}`, `url("${kitUrl(name)}")`); root.classList.add(`kit-${name}`) }
    image.src = kitUrl(name); loaded.push(image)
  }
}
