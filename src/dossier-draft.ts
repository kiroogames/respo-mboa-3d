/* Un brouillon garde seulement le tracé ; il ne valide jamais un dossier et ne verse rien. */
import { attemptDossierMove } from './dossier-puzzle.ts'
import type { DossierPuzzle } from './dossier-puzzle.ts'

const key = 'mboa-dossier-draft-v1'
export function restoreDossierDraft(board: DossierPuzzle, batch: string, index: number, storageKey = key): number[] {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
    if (saved?.version !== 2 || saved.batch !== batch || saved.index !== index || !Array.isArray(saved.path) || saved.path[0] !== board.start || saved.path.length > board.size * board.size) return [board.start]
    let path = [board.start]
    // Rejouer les pas vérifie les obstacles, les flèches et l’absence de saut ou de répétition.
    for (const cell of saved.path.slice(1)) {
      const result = attemptDossierMove(board, path, cell)
      if (result.rejected || result.path.length !== path.length + 1) return [board.start]
      path = result.path
    }
    return path
  } catch { return [board.start] }
}
export function saveDossierDraft(batch: string, index: number, path: readonly number[], storageKey = key) {
  try { localStorage.setItem(storageKey, JSON.stringify({ version: 2, batch, index, path })) } catch { /* Le tracé reste disponible dans la session. */ }
}
export function clearDossierDraft(storageKey = key) {
  try { localStorage.removeItem(storageKey) } catch { /* Aucun effet sur le paiement ni sur la pile. */ }
}
