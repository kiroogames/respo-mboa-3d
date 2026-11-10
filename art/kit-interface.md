# Kit d'interface à générer — thème « bureau du fonctionnaire »

Ces pièces remplacent les cadres, boutons et icônes dessinés par le code. Le jeu adopte chaque pièce
dès que son fichier existe : on peut donc livrer le kit morceau par morceau.

## Où déposer les fichiers

Dans `public/ui/kit/`, avec **exactement** le nom indiqué, au format **PNG avec fond transparent**.
Aucune modification du code n'est nécessaire.

## Direction artistique

Tout doit sembler sortir du même bureau d'un ministère camerounais :

- **Matières :** chemises cartonnées (kraft, orange, vert administratif), papier légèrement jauni, bois verni
  d'un vieux bureau, tampons encreurs, trombones, agrafes, étiquettes de classeur.
- **Touche locale :** un liseré de pagne wax (motifs géométriques vert, jaune, rouge) en bordure ou en coin, jamais sur toute la surface.
- **Style :** peint à la main, cartoon, contours brun foncé épais et réguliers, ombres simples, couleurs chaudes.
  Même trait que les illustrations `public/ui/menu-*.jpg`.
- **Lisibilité :** le centre de chaque pièce reste uni et clair (ou uni et foncé pour le HUD) : du texte sera écrit dessus.
- **Interdits :** aucun texte, aucun chiffre, aucun logo, aucun personnage dans les pièces du kit.

Méthode conseillée, pour que tout aille ensemble : générer d'abord **une seule planche** montrant toutes les pièces
côte à côte, la valider, puis découper ou régénérer chaque pièce à partir de cette planche.

## Règle de découpage (important)

Les cadres sont étirés par le jeu : les **coins** gardent leur forme, les **bords** et le **centre** s'étirent.

- Tout décor (rivets, trombone, coin de pagne, ombre) doit tenir **dans les coins**, dans la marge indiquée.
- Les bords entre deux coins doivent être **uniformes** sur toute leur longueur (pas de motif qui se répète mal une fois étiré).
- Le centre doit être **uni** (une légère texture de papier est acceptable).
- L'ombre portée fait partie de l'image et doit rester à l'intérieur du fichier.

## Cadres et boutons

| Fichier | Taille | Marge des coins | Rôle | Description |
|---|---|---|---|---|
| `panel.png` | 768 × 768 | 96 px | Fenêtre de jeu | Grande chemise cartonnée ouverte ou sous-main de bureau : bord brun épais (60 px au plus), centre papier crème uni, coins renforcés, petit liseré wax dans deux coins. |
| `plaque.png` | 640 × 160 | 96 px à gauche et à droite | Titre de la fenêtre | Étiquette de classeur ou plaque de bureau jaune doré, extrémités décorées (rivets ou languettes), milieu uni. Seule la partie centrale s'étire en largeur. |
| `button-primary.png` | 320 × 128 | 40 px | Action principale (Manger, Y aller, Traiter…) | Gros bouton façon tampon « APPROUVÉ » sans texte : vert administratif vif, relief en bas pour l'effet de touche, reflet en haut. |
| `button-secondary.png` | 320 × 128 | 40 px | Retour, Annuler | Même forme que le bouton principal, en papier kraft clair, plus discret. |
| `card.png` | 384 × 384 | 48 px | Carte d'activité | Fiche bristol blanche légèrement jaunie, bord brun fin, coin corné ou trombone dans un seul coin. |
| `hud.png` | 320 × 160 | 40 px | Tuiles du haut de l'écran (argent, énergie, heure) et panneau « À faire » | Plaque en bois verni foncé ou ardoise verte, bord doré fin ; centre foncé uni, car le texte dessus est blanc. |
| `close.png` | 128 × 128 | — (non étirée) | Fermer la fenêtre | Tampon rond rouge avec une croix blanche épaisse, contour brun. |

## Icônes

PNG 128 × 128, fond transparent, sujet centré, contour brun épais, lisibles en tout petit (42 px à l'écran).
Une seule idée par icône, pas de détail fin.

| Fichier | Sens | Dessin |
|---|---|---|
| `icon-meal.png` | Manger | Assiette fumante avec une cuillère. |
| `icon-transport.png` | Se déplacer | Taxi jaune vu de trois quarts. |
| `icon-dossier.png` | Travailler | Chemise cartonnée orange avec un tampon. |
| `icon-sleep.png` | Dormir | Oreiller avec « z z » dessinés en formes, sans lettres lisibles. |
| `icon-bills.png` | Factures | Facture pliée avec un cachet rouge. |
| `icon-energy.png` | Énergie | Éclair jaune. |
| `icon-mood.png` | Humeur | Visage souriant jaune. |
| `icon-tontine.png` | Tontine | Calebasse ou cuvette pleine de billets. |
| `icon-ceremony.png` | Cérémonie | Enveloppe décorée d'un ruban. |
| `icon-savings.png` | Épargner | Tirelire ou boîte de conserve avec une pièce. |
| `icon-level.png` | Niveau Respo | Étoile dorée sur une cravate verte. |

## Ce que le kit ne couvre pas encore

Onglets, jauges d'énergie et d'humeur, pastilles de prix, boutons du bas de l'écran et étiquettes des lieux
gardent leur apparence actuelle. Ils seront ajoutés à cette liste une fois le premier lot validé dans le jeu.

## Vérifier une pièce

Déposer le fichier, recharger le jeu, ouvrir un lieu. Si la pièce n'apparaît pas : vérifier le dossier
(`public/ui/kit/`), le nom en minuscules avec tiret, et l'extension `.png`.
Si un décor est déformé, c'est qu'il dépasse de la marge des coins indiquée dans le tableau.
