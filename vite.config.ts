import { defineConfig } from 'vite'
import { execSync } from 'node:child_process'

// Version affichée dans le menu du jeu : numéro de déploiement, commit construit et date de construction (heure du Cameroun).
function appVersion() {
  let commit = process.env.GITHUB_SHA?.slice(0, 7) ?? ''
  try { commit ||= execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim() } catch { /* Hors dépôt git. */ }
  const date = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Douala', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date())
  // Numéro de déploiement GitHub : il augmente tout seul à chaque push sur main. En local : « dev ».
  const number = process.env.GITHUB_RUN_NUMBER ? `v${process.env.GITHUB_RUN_NUMBER}` : 'dev'
  return `${number} · ${commit || 'local'} · ${date}`
}

// Chemins relatifs : le build fonctionne à la racine d’un domaine comme dans un sous-dossier
// (GitHub Pages sert le site sous /<nom-du-dépôt>/), sans connaître le nom du dépôt à l’avance.
export default defineConfig({ base: './', define: { __APP_VERSION__: JSON.stringify(appVersion()) } })
