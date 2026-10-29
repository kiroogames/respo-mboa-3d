/*
 * Puzzle de visas : relier le dépôt à la signature avec une seule ligne orthogonale.
 * Une graine stable conserve la même grille après fermeture ou rechargement du dossier.
 */
export type DossierDirection = 'up' | 'right' | 'down' | 'left'
export type DossierPuzzle = { pairs?: number[][]; size: number; start: number; goal: number; visas: number[]; blocked: number[]; arrows?: { cell: number; direction: DossierDirection }[]; level?: number }
export const visaNames = ['Accueil', 'Technique', 'Finances']
export const directionSymbols: Record<DossierDirection, string> = { up: '↑', right: '→', down: '↓', left: '←' }
const directionNames: Record<DossierDirection, string> = { up: 'le haut', right: 'la droite', down: 'le bas', left: 'la gauche' }

export function getDossierDifficulty(difficulty: number) {
  const level = Number.isFinite(difficulty) ? Math.max(0, Math.min(4, Math.floor(difficulty))) : 0
  return { level, label: level === 0 ? 'Courant' : level < 3 ? 'Contrôle renforcé' : 'Dossier sensible', arrows: level === 0 ? 0 : level < 3 ? 1 : level - 1 }
}

function generator(seed: string) {
  let state = 2166136261
  for (const character of seed) state = Math.imul(state ^ character.charCodeAt(0), 16777619)
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return (state >>> 0) / 4294967296 }
}
function neighbours(cell: number, size: number) {
  const x = cell % size, y = Math.floor(cell / size)
  return [x > 0 ? cell - 1 : -1, x < size - 1 ? cell + 1 : -1, y > 0 ? cell - size : -1, y < size - 1 ? cell + size : -1].filter(cell => cell >= 0)
}

export function createDossierPuzzle(seed: string, difficulty = 0): DossierPuzzle {
  const { level, arrows: arrowCount } = getDossierDifficulty(difficulty)
  const size = 5, start = 20, goal = 4, random = generator(`visas-v2/${seed}`)
  const shuffle = (values: number[]) => {
    for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [values[i], values[j]] = [values[j]!, values[i]!] }
    return values
  }
  const route = [start], visited = new Set(route)
  let attempts = 0
  // On réserve d’abord une solution ; seuls les espaces hors de ce chemin peuvent être bloqués.
  function carve(cell: number): boolean {
    if (++attempts > 40000) return false
    if (cell === goal) return route.length >= 9 + level * 2
    if (route.length >= 13 + level * 2) return false
    const remainingDistance = Math.abs(cell % size - goal % size) + Math.abs(Math.floor(cell / size) - Math.floor(goal / size))
    if (route.length + remainingDistance > 13 + level * 2) return false
    for (const next of shuffle(neighbours(cell, size))) {
      if (visited.has(next)) continue
      visited.add(next); route.push(next)
      if (carve(next)) return true
      visited.delete(next); route.pop()
    }
    return false
  }
  if (!carve(start)) {
    const fallback = level < 2 ? [20,15,10,5,0,1,6,11,12,7,2,3,4] : level < 4 ? [20,21,22,23,24,19,18,17,16,15,10,5,0,1,2,3,4] : [20,21,22,23,24,19,14,13,18,17,16,15,10,11,6,5,0,1,2,3,4]
    route.splice(0, route.length, ...fallback)
  }
  // Rotations et symétries changent les entrées sans compromettre la solution réservée.
  const rotations = Math.floor(random() * 4), mirror = random() < .5
  const transform = (cell: number) => {
    let x = cell % size, y = Math.floor(cell / size)
    if (mirror) x = size - 1 - x
    for (let i = 0; i < rotations; i++) [x, y] = [size - 1 - y, x]
    return y * size + x
  }
  const solution = route.map(transform)
  const visas = [.25, .5, .75].map(fraction => solution[Math.floor((solution.length - 1) * fraction)]!)
  const free = shuffle(Array.from({ length: size * size }, (_, cell) => cell).filter(cell => !route.includes(cell)))
  const blocked = free.slice(0, Math.min(free.length, 4 + level)).map(transform)
  const arrowCells = shuffle(solution.slice(1, -1).filter(cell => !visas.includes(cell))).slice(0, arrowCount)
  const arrows = arrowCells.map(cell => ({ cell, direction: directionBetween(cell, solution[solution.indexOf(cell) + 1]!, size) }))
  const pairs=Array.from({length:4},(_,i)=>{const part=solution.slice(Math.floor(i*solution.length/4),Math.floor((i+1)*solution.length/4));return [part[0]!,part.at(-1)!]})
  return { pairs,size, start: solution[0]!, goal: solution.at(-1)!, visas, blocked, arrows, level }
}

function directionBetween(from: number, to: number, size: number): DossierDirection {
  return to - from === 1 ? 'right' : to - from === -1 ? 'left' : to - from === size ? 'down' : 'up'
}
function exitAllowed(board: DossierPuzzle, from: number, to: number) {
  const arrow = board.arrows?.find(arrow => arrow.cell === from)
  return !arrow || directionBetween(from, to, board.size) === arrow.direction
}

/** Le moteur vérifie aussi le chemin : une interface ne peut pas déclarer une réussite seule. */
export function validateDossierPath(board: DossierPuzzle, path: readonly number[]) {
  if(path?.[0]===-99)return (scoreDossierPairs(board,path)??0)>0
  if (!Array.isArray(path) || !path.length || path[0] !== board.start || path.length > board.size * board.size) return false
  const seen = new Set<number>()
  for (let i = 0; i < path.length; i++) {
    const cell = path[i]!
    if (!Number.isInteger(cell) || cell < 0 || cell >= board.size * board.size || seen.has(cell) || board.blocked.includes(cell)) return false
    if (i > 0 && !neighbours(path[i - 1]!, board.size).includes(cell)) return false
    if (i > 0 && !exitAllowed(board, path[i - 1]!, cell)) return false
    if (cell === board.goal && i !== path.length - 1) return false
    seen.add(cell)
  }
  return path.at(-1) === board.goal && board.visas.every(cell => seen.has(cell))
}

/** Revenir sur une case du tracé efface sa suite ; sauter ou traverser un blocage est refusé. */
export function moveDossierPath(board: DossierPuzzle, path: readonly number[], cell: number) {
  return attemptDossierMove(board, path, cell).path
}

/** Une correction du tracé reste toujours autorisée, y compris sur une case fléchée. */
export function attemptDossierMove(board: DossierPuzzle, path: readonly number[], cell: number) {
  const refuse = (message: string) => ({ path: [...path], rejected: true, message })
  if (!Number.isInteger(cell) || cell < 0 || cell >= board.size * board.size) return refuse('Restez à l’intérieur du formulaire.')
  const existing = path.indexOf(cell)
  if (existing >= 0) return { path: path.slice(0, existing + 1), rejected: false, message: '' }
  const last = path.at(-1)
  if (last === undefined || !neighbours(last, board.size).includes(cell)) return refuse('Choisissez une case voisine, sans diagonale.')
  if (last === board.goal) return refuse('Revenez sur le tracé pour récupérer les visas manquants.')
  if (board.blocked.includes(cell)) return refuse('Passage bloqué : cherchez une autre voie pour le dossier.')
  if (!exitAllowed(board, last, cell)) {
    const direction = board.arrows!.find(arrow => arrow.cell === last)!.direction
    return refuse(`Ce bureau impose une sortie vers ${directionNames[direction]}.`)
  }
  return { path: [...path, cell], rejected: false, message: '' }
}

/** Indique seulement les prochains pas légaux, jamais la solution complète. */
export function getDossierNextCells(board: DossierPuzzle, path: readonly number[]) {
  const last = path.at(-1)
  return last === undefined || last === board.goal ? [] : neighbours(last, board.size).filter(cell => !path.includes(cell) && !board.blocked.includes(cell) && exitAllowed(board, last, cell))
}

// Format borné : marqueur, puis quatre longueurs et leurs cellules. Les paiements recomptent les paires.
export function encodeDossierPairs(paths:readonly number[][]){return [-99,...paths.flatMap(path=>[path.length,...path])]}
export function scoreDossierPairs(board:DossierPuzzle,encoded:readonly number[]):number|null{
 if(!Array.isArray(encoded)||encoded[0]!==-99||!board.pairs||encoded.length>30)return null
 let cursor=1,count=0;const occupied=new Set<number>()
 for(let i=0;i<4;i++){
  const length=encoded[cursor++]!;if(!Number.isInteger(length)||length<0||length>25)return null
  const path=encoded.slice(cursor,cursor+length);cursor+=length
  if(!length)continue
  const pair=board.pairs[i]!;if(length<2||path.length!==length||!pair.includes(path[0]!)||!pair.includes(path.at(-1)!)||path[0]===path.at(-1))return null
  for(let j=0;j<length;j++){
   const cell=path[j]!;if(!Number.isInteger(cell)||cell<0||cell>=25||occupied.has(cell)||board.blocked.includes(cell)||board.pairs.some((p,k)=>k!==i&&p.includes(cell))||j>0&&!neighbours(path[j-1]!,5).includes(cell))return null
   occupied.add(cell)
  }count++
 }
 return cursor===encoded.length?count:null
}
export function dossierPayout(board:DossierPuzzle,path:readonly number[],maximum:number){
 const pairs=path[0]===-99?scoreDossierPairs(board,path):4
 return pairs===null?0:Math.floor(maximum*pairs/4)
}

export function validPairDraft(board:DossierPuzzle,paths:unknown):paths is number[][]{
 if(!Array.isArray(paths)||paths.length!==4||!board.pairs)return false
 const seen=new Set<number>()
 for(let i=0;i<4;i++){
  const p=paths[i];if(!Array.isArray(p)||p.length>25||p.length&&!board.pairs[i]!.includes(p[0]))return false
  for(let j=0;j<p.length;j++){
   const c=p[j];if(!Number.isInteger(c)||c<0||c>=25||seen.has(c)||board.blocked.includes(c)||board.pairs.some((pair,k)=>k!==i&&pair.includes(c))||j>0&&!neighbours(p[j-1],5).includes(c)||j>0&&j<p.length-1&&board.pairs[i]!.includes(c))return false
   seen.add(c)
  }
 }return true
}
