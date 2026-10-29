/*
 * Dialogue partagé par les PNJ : identité, sujets Unity et demandes de Bae.
 * La présence sur place est revérifiée à chaque action et lors des changements d’heure.
 */

import dialogues from './data/bae-dialogues.json' with { type: 'json' }
import otherDialogues from './data/npc-dialogues.json' with { type: 'json' }
import { isNPCAvailable, npcTemplates } from './npcs'
import { acceptNPCRequest, getConsideration, getNPCRequests, isRequestAccepted, purchaseNPCImprovement } from './npc-relationships'
import { getMoneyBalance } from './currency'
import { onGameTimeChange } from './game-clock'

type Line = { text: string; speaker: string; key: string }
type Topic = { id: string; label: string; lines: Line[]; responses?: { label: string; lines: Line[] }[] }
const topicsByNPC: Record<string, Topic[]> = { ...otherDialogues.topics, bae: dialogues.topics }
export function mountNPCDialogue(options: { base: string; canInteract: (npcId: string) => boolean; back: (npcId: string) => void }) {
  let activeNPC = 'bae'
  const dialog = document.createElement('dialog')
  dialog.className = 'travel-dialog npc-dialogue-dialog'
  dialog.setAttribute('aria-labelledby', 'npc-conversation-title')
  dialog.innerHTML = `<button class="travel-close" aria-label="Fermer">×</button><header class="npc-conversation-header"><img src="${options.base}portraits/bae.png" alt="Bae" width="72" height="72"><div><h2 id="npc-conversation-title">Bae</h2><p class="npc-consideration"><span aria-hidden="true">♥</span> Considération <strong></strong></p></div></header><h3 id="npc-conversation-topic"></h3><p id="npc-conversation-text" aria-live="polite"></p><div id="npc-conversation-actions"></div><button class="travel-cancel">Retour au menu de Bae</button>`
  document.body.append(dialog)
  const content = dialog.querySelector<HTMLElement>('#npc-conversation-text')!
  const actions = dialog.querySelector<HTMLElement>('#npc-conversation-actions')!
  const title = dialog.querySelector<HTMLElement>('#npc-conversation-topic')!
  // Le lieu peut avoir changé pendant un dialogue si une action a fait avancer l’heure du jeu.
  function allowed() { return options.canInteract(activeNPC) && isNPCAvailable(activeNPC) }
  function button(label: string, action: () => void) {
    const button = document.createElement('button'); button.textContent = label
    button.onclick = () => { if (!allowed()) { dialog.close(); return } action() }
    actions.append(button)
    return button
  }
  // Les clés sources sont conservées dans le DOM pour vérifier les textes importés de Unity.
  function lines(sequence: Line[], finish: () => void, index = 0, finalLabel = 'Retour aux sujets') {
    if (!sequence[index]) { finish(); return }
    const line = sequence[index]!
    content.textContent = line.text; content.dataset.source = line.key
    actions.replaceChildren(); button(index < sequence.length - 1 ? 'Continuer' : finalLabel, () => lines(sequence, finish, index + 1, finalLabel))
  }
  function topics() {
    title.textContent = `Parler avec ${npcTemplates.find(npc => npc.id === activeNPC)!.name}`; content.textContent = 'De quoi souhaitez-vous parler ?'; delete content.dataset.source
    actions.replaceChildren()
    for (const topic of topicsByNPC[activeNPC] ?? []) button(topic.label, () => {
      title.textContent = topic.label
      lines(topic.lines, () => {
        if (!('responses' in topic) || !topic.responses) { topics(); return }
        actions.replaceChildren()
        for (const response of topic.responses) button(response.label, () => lines(response.lines, topics))
      }, 0, topic.responses?.length ? 'Répondre' : 'Retour aux sujets')
    })
  }
  // Change l’identité et les sujets du même dialogue, au lieu de créer une fenêtre par personnage.
  function open(npcId: string, serviceId: string) {
    const npc = npcTemplates.find(npc => npc.id === npcId)
    if (!npc || !topicsByNPC[npcId] || (serviceId !== 'talk' && !getNPCRequests(npcId).some(request => `request:${request.id}` === serviceId))) return
    activeNPC = npcId
    if (!allowed()) return
    dialog.dataset.npcId = npcId
    dialog.querySelector('#npc-conversation-title')!.textContent = npc.name
    const portrait = dialog.querySelector<HTMLImageElement>('.npc-conversation-header img')!
    portrait.src = options.base + npc.portrait; portrait.alt = npc.name
    dialog.querySelector('.travel-cancel')!.textContent = `Retour au menu de ${npc.name}`
    dialog.querySelector('.npc-consideration strong')!.textContent = `${getConsideration(npcId)} %`
    if (serviceId === 'talk') topics()
    else {
      const request = getNPCRequests('bae').find(item => `request:${item.id}` === serviceId)
      if (!request) return
      title.textContent = request.title
      lines(request.lines, () => {
        // L’acceptation et le bouton de paiement sont deux étapes distinctes ; le solde est contrôlé à nouveau.
        function summary() {
          content.textContent = `${request!.objective}\nCoût : ${request!.money.toLocaleString('fr-FR')} Nkap.\nVotre solde : ${getMoneyBalance().toLocaleString('fr-FR')} Nkap.`
          actions.replaceChildren()
          if (!isRequestAccepted(request!.id)) button('Accepter la demande (sans paiement)', () => { acceptNPCRequest(request!.id); summary() })
          else {
            const pay = button(`Confirmer et payer ${request!.money.toLocaleString('fr-FR')} Nkap`, () => {
              const outcome = purchaseNPCImprovement(request!.id)
              content.textContent = outcome.reason
              actions.replaceChildren()
              if (!outcome.ok) button('Revoir le coût', summary)
            })
            pay.dataset.payImprovement = request!.id
            pay.disabled = getMoneyBalance() < request!.money
            if (pay.disabled) {
              const reason = document.createElement('p'); reason.className = 'npc-insufficient'; reason.textContent = `Nkap insuffisants : il manque ${(request!.money - getMoneyBalance()).toLocaleString('fr-FR')} Nkap.`; actions.append(reason)
            }
          }
        }
        summary()
      }, 0, 'Voir le coût')
    }
    if (!dialog.open) dialog.showModal()
  }
  dialog.querySelector('.travel-close')!.addEventListener('click', () => dialog.close())
  dialog.querySelector('.travel-cancel')!.addEventListener('click', () => { dialog.close(); if (allowed()) options.back(activeNPC) })
  onGameTimeChange(() => { if (dialog.open && !allowed()) dialog.close() })
  return { open }
}
