# Mboa Ville — Exploration 3D

Maquette Babylon.js de la ville de `Scene_WorldMap_WSP`, avec les bâtiments du projet Unity, le stade, l’aéroport, la présidence, le marché et la rue du Njoka.

## Lancer

```powershell
npm.cmd install
npm.cmd run dev
```

Pour ouvrir la ville depuis un autre appareil du même réseau :

```powershell
npm.cmd run dev -- --host 0.0.0.0
```

Ouvrir l’adresse **Network** affichée par Vite sur l’autre appareil et garder le terminal ouvert. Pour préparer la version distribuable : `npm.cmd run build`. Les fichiers sont générés dans `dist/`.

Glisser pour tourner, molette ou pincement pour zoomer, clic droit et glisser pour déplacer le regard. Les boutons du bas et les repères sur la carte rapprochent la caméra des lieux. Sur mobile, faire défiler la barre des lieux horizontalement. Le bouton de soleil active le soir, « Visite » fait tourner la caméra, et `Échap` ferme la référence ou l’aide.

## Sources et génération

- Scène Unity : `E:/WORK_DEV_YOUMSI/DEVWORK/LeResponsableMboa/Assets/Test/Scenes/Scene_WorldMap_WSP.unity`.
- Bibliothèque 3D référencée par cette scène : `Assets/Test/Sprites/Decor/WorldMap_WSP/3D/3D WorldMap_003.blend`.
- `scripts/build_wsp.py` : export actif de la nouvelle ville.
- `city-layout.json` : agrandissement horizontal (1,6) et espacement minimal des maisons (4 unités).
- `scripts/wsp_layout.py` : implantation des maisons, avec vérification des distances, des routes et de l’eau.
- `scripts/wsp_details.py` : détails des façades, eau, mobilier, passants et tracé de circulation évitant les bâtiments.
- `src/city-life.ts` : taxis, bateaux et oiseaux animés.
- `scripts/wsp-report.json` : provenance, textures réparées, implantation des modèles, relief et vérification de la statue.
- `public/models/mboa-wsp.glb` : modèle complet avec textures intégrées.
- `public/reference/worldmap-wsp.png` : capture Unity fournie, affichée par le bouton de référence.
- `src/main.ts` : scène, chargement, regroupement des géométries, lumière, caméra et repères interactifs.
- `src/surfaces.ts` : matériaux de surface, animation de l’eau et lampadaires du soir.

L’implantation des quartiers vient du fichier Blender référencé par la scène. Le terrain et les distances entre quartiers sont agrandis de 60 % dans les deux directions, soit une surface multipliée par 2,56. Les 104 maisons conservent leurs dimensions et disposent d’au moins 4 unités libres entre leurs emprises ; leur placement évite les rues peintes et l’eau. Les caméras, repères, véhicules et accès suivent cette implantation. À la demande de l’utilisateur, la présidence est décalée vers l’ouest dans une zone boisée prolongée, avec une route d’accès dédiée. Les bâtiments sont posés sur le terrain ; la présidence domine une colline de 30 unités, au sommet arrondi et aux pentes élargies. La colline reste séparée des quartiers existants, dont le niveau est vérifié à l’export. L’assise sous la présidence est également vérifiée. La sculpture d’origine conserve son maillage et sa texture. Les rues et parkings gardent le dessin de sol d’origine ; les bâtiments, les arbres et le pont sont des géométries en volume. Les éléments 2D et certains réglages propres à Unity sont interprétés pour la version web, et quelques matériaux manquants sont remplacés.

Le socle du paysage est ouvert au-dessus : seul le terrain fournit la surface visible. Cela évite le scintillement des deux anciennes faces presque superposées. Le plan proche de la caméra suit la distance de vue pour conserver la précision de profondeur au dézoom. Le GPS compose son cadre avec le portrait redressé, centré et légèrement agrandi.

L’export répare les chemins des textures en mémoire et ne sauvegarde jamais le fichier Blender ou la scène Unity source.

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' --background 'E:/WORK_DEV_YOUMSI/DEVWORK/LeResponsableMboa/Assets/Test/Sprites/Decor/WorldMap_WSP/3D/3D WorldMap_003.blend' --python scripts/build_wsp.py
```

Vérifier le message `WSP_EXPORT` à la fin du journal. Le script vérifie notamment que les modèles clés et la statue ne sont pas masqués à l’export.

L’ancienne maquette, son modèle et ses scripts de génération ont été supprimés. Cette version charge uniquement `mboa-wsp.glb`.

La ville comporte 300 arbres. La circulation utilise le maillage du véhicule d’origine et un trajet calculé sur les rues peintes, en excluant les emprises des bâtiments. Le bouton de pause arrête les véhicules, les bateaux, les oiseaux et l’eau. Les préférences système de réduction des animations sont respectées. Le soir allume les lampadaires, les fenêtres ajoutées et l’éclairage de la présidence.

## Vérifier

Avec Vite lancé sur `http://127.0.0.1:5174/`, exécuter `node scripts/preview-check.mjs`. Le contrôle ouvre Chrome sans fenêtre, parcourt les lieux et les vues autour de la ville, vérifie le déplacement et la pause des véhicules, essaie les commandes et le format mobile, puis écrit les captures et le résultat dans `artifacts/`. Il utilise le port de débogage 9226 et l’installation Windows de Chrome indiquée dans le script.
Le contrôle ciblé `node scripts/render-stability-check.mjs` vérifie 12 positions et petites rotations de caméra, dont le dézoom maximal. Il colore temporairement le socle dans son navigateur de contrôle et vérifie qu’il ne traverse pas le terrain. Il contrôle également l’orientation du GPS et écrit ses captures et mesures dans `artifacts/`.
