/* Fenêtre de la caisse de la dot, à la maison : montant au choix, aperçu, dépôt et reçu. */
import { loc, gameLocale } from './i18n.ts'
import { dowryRules as rules, getDowryState, dowryPresenceReason, previewDowry, depositDowry, onDowryChange } from './dowry'
import { onMoneyBalanceChange } from './currency'

export function mountDowry(options: { currentZone: () => string; travelling: () => boolean; back: () => void }) {
  const dialog = document.createElement('dialog'); dialog.className = 'travel-dialog toque-dialog dowry-dialog'; dialog.setAttribute('aria-labelledby', 'dowry-heading')
  dialog.innerHTML = `<button class="travel-close" data-dowry-close aria-label="${loc('Fermer')}">×</button><span class="travel-eyebrow">${loc('QUÊTE PRINCIPALE')}</span><h2 id="dowry-heading">${loc('Caisse de la dot')}</h2><section class="toque-progress"><span data-dowry-status></span><strong data-dowry-total></strong><progress max="${rules.target}" value="0" aria-label="${loc('Argent réuni pour la dot')}"></progress><small data-dowry-remaining></small></section><p data-dowry-wallet></p><div class="toque-controls"><label for="dowry-amount">${loc('Montant à mettre de côté')}</label><input id="dowry-amount" type="number" inputmode="numeric" min="${rules.minimum}" step="${rules.step}" value="1000"/><div class="toque-presets">${rules.presets.map(amount => `<button type="button" data-dowry-amount="${amount}">${amount.toLocaleString(gameLocale)}</button>`).join('')}<button type="button" data-dowry-max>${loc('Tout')}</button></div><div class="toque-preview"><p data-dowry-after-total></p><p data-dowry-after-wallet></p></div></div><p class="toque-policy">${loc('L’argent déposé est mis de côté pour la dot : il ne se dépense plus. Pense à garder de quoi payer les factures du vendredi.')}</p><p class="toque-error" data-dowry-error role="alert" hidden></p><div class="toque-result" data-dowry-result role="status" hidden></div><div class="toque-actions"><button type="button" data-dowry-back>${loc('Retour')}</button><button type="button" data-dowry-confirm>${loc('Mettre de côté')}</button></div>`
  document.body.append(dialog)
  const input = dialog.querySelector<HTMLInputElement>('#dowry-amount')!, confirm = dialog.querySelector<HTMLButtonElement>('[data-dowry-confirm]')!
  const error = dialog.querySelector<HTMLElement>('[data-dowry-error]')!, result = dialog.querySelector<HTMLElement>('[data-dowry-result]')!
  const format = (n: number) => n.toLocaleString(gameLocale) + ' Nkap'
  const allowed = () => document.documentElement.dataset.ready === 'true' && ![...document.querySelectorAll('dialog[open]')].some(d => d !== dialog)
  const context = () => ({ zone: options.currentZone(), travelling: options.travelling(), allowed: allowed() })
  const text = (selector: string, value: string) => { dialog.querySelector(selector)!.textContent = value }
  let committing = false
  function render() {
    const p = previewDowry(input.valueAsNumber, context())
    text('[data-dowry-status]', p.complete ? loc('Dot réunie !') : loc('Argent réuni'))
    text('[data-dowry-total]', `${p.saved.toLocaleString(gameLocale)} / ${format(p.target)}`)
    dialog.querySelector<HTMLProgressElement>('progress')!.value = p.saved
    text('[data-dowry-remaining]', p.complete ? loc('Bravo, la dot est prête.') : loc('Reste à réunir : {0}', format(p.remaining)))
    text('[data-dowry-wallet]', loc('Ton argent : {0}', format(p.balance)))
    text('[data-dowry-after-total]', loc('Dans la caisse après : {0}', p.afterSaved === null ? '—' : format(p.afterSaved)))
    text('[data-dowry-after-wallet]', loc('Argent restant : {0}', p.afterBalance === null ? '—' : format(p.afterBalance)))
    error.hidden = !p.reason || p.complete; error.textContent = p.reason
    const blocked = committing || p.complete || !!dowryPresenceReason(context())
    input.disabled = blocked
    for (const button of dialog.querySelectorAll<HTMLButtonElement>('[data-dowry-amount]')) { const amount = Number(button.dataset.dowryAmount); button.disabled = blocked || amount > p.remaining || amount > p.balance; button.setAttribute('aria-pressed', String(amount === input.valueAsNumber)) }
    dialog.querySelector<HTMLButtonElement>('[data-dowry-max]')!.disabled = blocked || p.balance < rules.minimum
    dialog.querySelector<HTMLElement>('.toque-controls')!.hidden = p.complete
    confirm.hidden = p.complete; confirm.disabled = committing || !!p.reason
  }
  function close() { if (committing) return; dialog.close(); options.back() }
  for (const selector of ['[data-dowry-close]', '[data-dowry-back]']) dialog.querySelector(selector)!.addEventListener('click', close)
  dialog.addEventListener('cancel', event => { event.preventDefault(); close() })
  input.oninput = () => { result.hidden = true; render() }
  dialog.querySelector('.toque-presets')!.addEventListener('click', event => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button'); if (!button || button.disabled) return
    const state = getDowryState(), wallet = Math.floor(previewDowry(0, context()).balance / rules.step) * rules.step
    input.value = String(button.hasAttribute('data-dowry-max') ? Math.min(state.remaining, wallet) : Number(button.dataset.dowryAmount)); result.hidden = true; render()
  })
  confirm.onclick = () => {
    if (committing || confirm.disabled) return
    committing = true
    try {
      const outcome = depositDowry(input.valueAsNumber, context())
      if (!outcome.ok) { error.hidden = false; error.textContent = outcome.reason; return }
      result.hidden = false
      result.innerHTML = `<b>${outcome.complete ? loc('La dot est réunie !') : loc('Argent mis de côté')}</b><strong>+${format(outcome.amount)}</strong><span>${loc('Dans la caisse : {0} / {1}', format(outcome.saved), format(outcome.target))}</span><small>${loc('Ton argent : {0}', format(outcome.balance))}</small>`
    } finally { committing = false; render() }
  }
  const refresh = () => { if (dialog.open && !committing) render() }
  onMoneyBalanceChange(refresh); onDowryChange(refresh)
  return {
    open() {
      if (!allowed() || dowryPresenceReason(context()) || dialog.open) return
      const state = getDowryState(), wallet = Math.floor(previewDowry(0, context()).balance / rules.step) * rules.step
      result.hidden = true; input.value = String(Math.max(rules.minimum, Math.min(1000, state.remaining, wallet || rules.minimum))); render(); dialog.showModal()
    },
    snapshot: () => ({ mode: dialog.open ? 'menu' : 'closed', ...getDowryState() }),
  }
}
