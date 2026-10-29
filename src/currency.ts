/*
 * Portefeuille Nkap persistant, indépendant du rendu.
 * Les débits refusent un solde insuffisant ; les montants sont des entiers sûrs non négatifs.
 */

const storageKey = 'mboa-money-v1'
const formatter = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
let balance = 0
try {
  const stored = localStorage.getItem(storageKey)
  if (stored !== null && Number.isSafeInteger(Number(stored)) && Number(stored) >= 0) balance = Number(stored)
} catch { /* Keep the wallet usable without browser storage. */ }

const listeners = new Set<() => void>()
export function onMoneyBalanceChange(listener:()=>void){listeners.add(listener);return ()=>listeners.delete(listener)}

export function getMoneyBalance() { return balance }

// Refuse aussi les dépassements numériques : les Nkap ne sont pas des valeurs flottantes.
function validateAmount(amount: number) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new RangeError('Le montant doit être un entier positif.')
}

function saveBalance() {
  try { localStorage.setItem(storageKey, String(balance)) } catch { /* Preserve this session's balance. */ }
  listeners.forEach(listener => listener())
}

// Future events explicitly credit or debit the wallet. Nothing changes automatically.
export function addMoney(amount: number) {
  validateAmount(amount)
  if (!Number.isSafeInteger(balance + amount)) throw new RangeError('Le solde dépasse le montant maximal.')
  balance += amount
  saveBalance()
}

// Ne modifie ni le solde ni la sauvegarde si le paiement est impossible.
export function spendMoney(amount: number) {
  validateAmount(amount)
  if (amount > balance) return false
  balance -= amount
  saveBalance()
  return true
}

export function mountWallet(element: HTMLElement) {
  const update = () => {
    const formatted = formatter.format(balance)
    const amount = element.querySelector<HTMLElement>('#money-amount')!
    amount.textContent = formatted
    amount.title = formatted
    element.setAttribute('aria-label', `Argent disponible : ${formatted}`)
  }
  listeners.add(update)
  update()
  return () => listeners.delete(update)
}
