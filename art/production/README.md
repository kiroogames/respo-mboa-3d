# Livraison des illustrations — 10 novembre 2026

Les 41 visuels demandés sont présents dans les chemins attendus par le jeu :
- 23 JPEG640x640 dans `public/ui/menu-*.jpg`, pour les activités de `art/README.md`.
- 18 PNG dans `public/ui/kit/`, aux tailles de `art/kit-interface.md`, transparence conservée.

Ouvrir `galerie.html` dans un navigateur pour les parcourir ensemble.

## Références et génération

Voir `../charte-respo.md`. Identité et dessin guidés par les originaux fournis, notamment la planche Bae/Respo et le Respo traitant ses dossiers. Cheveux courts, moustache et bouc conservés ; tenue de travail blanche/verte adaptée aux briefs. Les couleurs et proportions sont une interprétation guidée, pas une reproduction exacte de chaque trait original.

Outil : imagegen intégré, un appel par illustration ou pièce. Prompts finaux dans `prompts.json`. La planche de direction du kit est `kit-direction.png`. Les PNG sources sélectionnés sont dans `../generated-sources/`. Les quatre premières icônes facture/énergie/humeur/tontine avaient repris la planche entière et ont été remplacées par des icônes isolées avant livraison.

## Exports et intégration

`export-assets.ps1` exporte les activités en JPEG avec fond blanc,640x640 et qualité87. `export-kit.ps1` conserve l’alpha et enlève seulement les marges transparentes inutiles, redimensionne les pièces aux tailles requises et normalise les coins du panneau et de la carte en neuf tranches. Les icônes restent proportionnées avec marge dans128x128. Les références sources ne sont pas modifiées.

`exports.json` décrit les dimensions, poids et alpha des41fichiers. Toutes les illustrations restent sous150Ko. Le mécanisme d’illustrations et le chargeur du kit existants adoptent ces fichiers. Corrections de contraste dans menus-arcade.css : texte clair sur HUD et boutons verts, titres sombres sur plaques dorées et titre mobile ajusté.

## Vérifications

Build réussi. Contrôle dimensions/poids/transparence réussi. Parcours Chrome CDP : cinq lieux (marché, JCD, restaurant, village, palmiers), trois tailles1557/390/320, images décodées et18classes du kit chargées, sans exception JavaScript. Captures dans artifacts/art-*.png. Client Playwright du skill tenté mais indisponible (module absent) ; repli sur le pilote CDP existant du projet.

Cette livraison concerne les visuels ; aucune nouvelle règle de gameplay n’est ajoutée. Les menus conservent le fonctionnement actuel du projet.

## Retouches après les captures utilisateur

Les quatre images de transport ont été refaites avec les références originales du Respo et remplacent les anciennes. Sources `../generated-sources/transport-*-respo.png`, exports `public/ui/transport-*.png`768x768 ; anciennes versions dans `previous-transports/`. Nouveau sommeil `public/ui/menu-sleep-respo.jpg`. Prompts `retouches-prompts.json` ; outil imagegen intégré. L’illustration originale fournie de traitement des dossiers est aussi réutilisée dans `public/ui/unity/respo-dossiers-original.png`.

Aperçu des lieux : illustrations réelles à la place des emojis quand disponibles, grille2colonnes, titres maison courts, prix/durée/gains conservés et informations de présence raccourcies. Cartes des services : illustration180px, action et chiffres, descriptions réduites aux horaires et motifs de fermeture brefs ; le texte complet reste dans le titre de l’élément et les fenêtres d’activité.

Sommeil : image à côté du réglage, coucher/réveil, énergie et humeur visibles, explications lit/fatigue/bonus dans Infos. Curseur, boutons de durée et confirmation conservés. Les règles de sommeil et de transport ne changent pas.
