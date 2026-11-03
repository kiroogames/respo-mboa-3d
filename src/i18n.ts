/*
 * Langue du jeu : le français reste le texte source, écrit dans le code et les données.
 * data/i18n-en.json associe chaque texte français à sa traduction ; un texte absent reste en français.
 * La langue est lue une seule fois au chargement : en changer recharge la page (voir start-menu.ts).
 */

import english from './data/i18n-en.json' with { type: 'json' }

export type Language = 'fr' | 'en'
const storageKey = 'mboa-language-v1'
const clean = (text: string) => text.replace(/\s+/g, ' ').trim()

function readLanguage(): Language | null {
  try {
    const saved = localStorage.getItem(storageKey)
    return saved === 'fr' || saved === 'en' ? saved : null
  } catch { return null }
}

const chosen = readLanguage()
const language: Language = chosen ?? 'fr'
const table = new Map<string, string>(Object.entries(english as Record<string, string>).map(([source, target]) => [clean(source), target]))

export const hasChosenLanguage = () => chosen !== null
export const getLanguage = () => language
// Locale des nombres et des dates, à la place de « fr-FR » écrit en dur.
export const gameLocale = language === 'en' ? 'en-US' : 'fr-FR'

export function saveLanguage(next: Language) {
  try { localStorage.setItem(storageKey, next) } catch { /* Sans stockage, le jeu reste dans sa langue source. */ }
}

// Traduit un texte source ; {0}, {1}… reçoivent les valeurs dynamiques. Les espaces autour du texte sont conservés.
export function loc(source: string, ...values: unknown[]) {
  let text = source
  if (language === 'en') {
    const target = table.get(clean(source))
    if (target !== undefined) text = source.slice(0, source.length - source.trimStart().length) + target + source.slice(source.trimEnd().length)
  }
  return values.length ? text.replace(/\{(\d+)\}/g, (_, index) => String(values[Number(index)])) : text
}

// Traduit toutes les chaînes connues d'un fichier de données, sans toucher aux identifiants techniques.
const technicalKeys = new Set(['id', 'key', 'source', 'priceSource', 'note', 'type', 'zone', 'transport'])
export function locData<T>(value: T, key = ''): T {
  if (language === 'fr' || technicalKeys.has(key)) return value
  if (typeof value === 'string') return loc(value) as T
  if (Array.isArray(value)) return value.map(item => locData(item, key)) as T
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, locData(item, name)])) as T
  return value
}

// Retrouve le texte source d'un texte affiché, pour les styles qui dépendent de la valeur française.
export function sourceOf(text: string) {
  if (language === 'fr') return text
  const shown = clean(text)
  for (const [source, target] of table) if (target === shown) return source
  return text
}

export function applyDocumentLanguage() {
  document.documentElement.lang = language
  document.title = loc('Mboa Ville — Exploration 3D')
  document.querySelector('meta[name="description"]')?.setAttribute('content', loc('Explorez Mboa Ville : une maquette 3D interactive inspirée de la ville illustrée, du marché à Mougabiang.'))
}
