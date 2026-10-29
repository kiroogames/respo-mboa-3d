/*
 * Logos des monnaies dans les fenêtres : « 500 Nkap », « −25 énergie », « +3 humeur », « +2 influence »
 * deviennent le nombre suivi du logo. Le texte d'origine reste lisible par les lecteurs d'écran (alt).
 * Fonctionne sur tout le texte des fenêtres, y compris celui reconstruit à chaque mise à jour.
 */

type Unit = 'nkap' | 'energy' | 'mood' | 'influence'
const units: Record<string, Unit> = { nkap: 'nkap', énergie: 'energy', humeur: 'mood', influence: 'influence' }
const labels: Record<Unit, string> = { nkap: 'Nkap', energy: 'énergie', mood: 'humeur', influence: 'influence' }
// Nombre (signe et séparateurs de milliers compris) suivi de l'unité, ou libellé suivi de « : ».
const amount = /((?:[+−–-]\s?)?\d[\d   ]*(?:[.,]\d+)?(?:\s?\/\s?\d[\d   ]*)?)[   ]?(Nkap|énergie|humeur|influence)(?![\p{L}])/giu
const label = /(?<![\p{L}])(Nkap|Énergie|Humeur|Influence)(?=\s?:)/gu
const skipped = 'script,style,textarea,select,option,input,.currency-chip,.popup-stats'

let base = './'
function icon(unit: Unit) {
  const element = unit === 'mood' ? document.createElement('span') : document.createElement('img')
  element.className = `currency-icon currency-icon-${unit}`
  if (element instanceof HTMLImageElement) {
    element.src = `${base}ui/${unit === 'nkap' ? 'currency-nkap' : unit === 'energy' ? 'currency-energy' : 'currency-respo'}.png`
    element.alt = labels[unit]
  } else {
    element.style.backgroundImage = `url('${base}ui/mood-sprites.png')`
    element.setAttribute('role', 'img'); element.setAttribute('aria-label', labels[unit])
  }
  return element
}

// Le texte suit déjà un logo de la même monnaie (« ⚡ +5 énergie ») : on garde le nombre sans doubler le logo.
function iconBefore(text: Text) {
  let previous = text.previousSibling
  while (previous && previous.nodeType === Node.TEXT_NODE && !previous.textContent!.trim()) previous = previous.previousSibling
  const isIcon = (node: Node | null) => node instanceof Element && (node.matches('img[src*="currency-"]') || !!node.lastElementChild?.matches('img[src*="currency-"]'))
  return previous ? isIcon(previous) : isIcon(text.parentElement?.previousElementSibling ?? null)
}

function convert(text: Text) {
  const value = text.data
  // matchAll repart de lastIndex : un test() préalable ferait manquer la première occurrence (et boucler).
  amount.lastIndex = 0; label.lastIndex = 0
  const pieces: (string | Node)[] = []
  const matches: { index: number; end: number; number?: string; unit: Unit }[] = []
  for (const match of value.matchAll(amount)) matches.push({ index: match.index!, end: match.index! + match[0].length, number: match[1]!.trim(), unit: units[match[2]!.toLowerCase()]! })
  for (const match of value.matchAll(label)) if (!matches.some(m => match.index! < m.end && match.index! + match[0].length > m.index)) matches.push({ index: match.index!, end: match.index! + match[0].length, unit: units[match[1]!.toLowerCase()]! })
  if (!matches.length) return
  matches.sort((a, b) => a.index - b.index)
  let cursor = 0
  const leadingIcon = iconBefore(text)
  for (const match of matches) {
    pieces.push(value.slice(cursor, match.index))
    const chip = document.createElement('span'); chip.className = 'currency-chip'
    if (leadingIcon && match === matches[0] && match.number !== undefined && !value.slice(0, match.index).trim()) {
      chip.append(match.number); chip.setAttribute('aria-label', `${match.number} ${labels[match.unit]}`)
      pieces.push(chip); cursor = match.end; continue
    }
    if (match.number !== undefined) chip.append(match.number + ' ')
    chip.append(icon(match.unit))
    pieces.push(chip); cursor = match.end
  }
  pieces.push(value.slice(cursor))
  text.replaceWith(...pieces.filter(piece => piece !== ''))
}

function scan(root: Element) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: node => node.parentElement?.closest(skipped) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  })
  const texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  texts.forEach(convert)
}

export function mountCurrencyIcons(assetBase: string) {
  base = assetBase
  const pending = new Set<Element>()
  let scheduled = false
  const flush = () => { scheduled = false; for (const root of pending) if (root.isConnected) scan(root); pending.clear() }
  const queue = (node: Node) => {
    const element = node instanceof Element ? node : node.parentElement
    const dialog = element?.closest('dialog.travel-dialog')
    if (!dialog) return
    pending.add(dialog)
    if (!scheduled) { scheduled = true; queueMicrotask(flush) }
  }
  new MutationObserver(records => {
    for (const record of records) {
      if (record.type === 'characterData') queue(record.target)
      else record.addedNodes.forEach(node => { if (node instanceof Element && node.matches('dialog.travel-dialog')) { pending.add(node); if (!scheduled) { scheduled = true; queueMicrotask(flush) } } else queue(node) })
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true })
  document.querySelectorAll('dialog.travel-dialog').forEach(dialog => scan(dialog))
}
