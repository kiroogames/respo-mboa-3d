import { defineConfig } from 'vite'

// Chemins relatifs : le build fonctionne à la racine d’un domaine comme dans un sous-dossier
// (GitHub Pages sert le site sous /<nom-du-dépôt>/), sans connaître le nom du dépôt à l’avance.
export default defineConfig({ base: './' })
