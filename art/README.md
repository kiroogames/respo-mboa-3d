# Illustrations à générer

Ce dossier liste les images dont le jeu a besoin pour la vie de quartier (jobs, plats, loisirs, vie sociale).
Tant qu'une image manque, le jeu affiche une illustration de secours : rien n'est cassé.

## Où déposer les fichiers

Déposer chaque image dans `public/ui/` avec **exactement** le nom indiqué (par exemple `public/ui/menu-benskin.jpg`).
Le jeu la prend en compte au prochain chargement, sans modifier le code.

## Format

- JPEG carré, 640 × 640 px, moins de 150 Ko environ.
- Fond blanc uni, sujet centré, marge d'environ 8 % autour.
- Aucun texte, aucun logo, aucune marque dans l'image.

## Style (identique aux images existantes)

Références à fournir à l'IA : `public/ui/menu-food.jpg`, `public/ui/menu-work.jpg`, `public/ui/menu-sleep.jpg`, `public/ui/menu-wait.jpg`.

- Dessin cartoon satirique, contours noirs épais, couleurs vives, ombres simples.
- Personnage principal « Le Respo » : fonctionnaire camerounais, peau foncée, crâne rasé, petite barbe,
  chemise blanche, cravate verte, pantalon vert foncé, chaussures noires. Expressions exagérées et drôles.
- Décor réduit à quelques accessoires ; pas de paysage complet.
- Ambiance : Cameroun urbain (Yaoundé / Douala), humour bon enfant.

Phrase de style à coller au début de chaque demande :

> Illustration cartoon satirique, contours noirs épais, couleurs vives, fond blanc uni, format carré, sans texte.
> Personnage : fonctionnaire camerounais au crâne rasé, petite barbe, chemise blanche, cravate verte, pantalon vert foncé.

## Liste des images

### Petits jobs

| Fichier | Utilisé pour | Description de la scène |
|---|---|---|
| `menu-benskin.jpg` | Faire le benskin (Rue JCD, Rue des BAOs) | Le Respo conduit une moto-taxi rouge à toute vitesse, cravate au vent, un passager cramponné derrière lui avec un sac ; nuage de poussière. |
| `menu-bayam.jpg` | Bayam-sellam (Marché) | Le Respo derrière un étal débordant de plantains, tomates et piments, il compte des billets d'un air malin ; une bassine sur la tête. |
| `menu-callbox.jpg` | Tenir le call-box (Rue JCD) | Le Respo assis sous un parasol jaune à une petite table en bois, plusieurs téléphones posés devant lui, il en tend un à un client hors champ. |
| `menu-repetiteur.jpg` | Cours de répétition (Education) | Le Respo debout devant un tableau noir, craie à la main, deux élèves en uniforme à un pupitre, l'un dort, l'autre lève le doigt. |
| `menu-snackjob.jpg` | Gérer le snack (Club matango, Rue du Njoka) | Le Respo derrière un comptoir de bar, tablier par-dessus la cravate, il porte un plateau chargé de bouteilles sans étiquette, l'air débordé ; guirlande lumineuse. |
| `menu-pousseur.jpg` | Pousser et charger les colis (Nsimaport, Supermarché) | Le Respo pousse un pousse-pousse (charrette à bras) surchargé de cartons et de sacs, en sueur, langue tirée. |

### Plats de rue

| Fichier | Utilisé pour | Description de la scène |
|---|---|---|
| `menu-bhb.jpg` | Beignets-haricots-bouillie (Marché) | Gros plan gourmand : assiette de beignets dorés, bol de haricots en sauce rouge, gobelet de bouillie blanche fumante ; le Respo ravi derrière, cuillère en main. |
| `menu-tournedos.jpg` | Manger au tourne-dos (Marché) | Le Respo assis sur un banc en bois, vu de dos tourné vers une table de cantine de rue, il se retourne en souriant avec une assiette de riz et de sauce bien remplie. |
| `menu-soya.jpg` | Soya bien pimenté (Rue du Njoka, Club) | Brochettes de viande grillée sur du papier kraft, oignons et piment rouge ; le Respo croque une brochette, larme à l'œil à cause du piment. |
| `menu-braise.jpg` | Poisson braisé et bobolo (Rue du Njoka) | Grand poisson braisé sur une assiette avec bâtons de manioc (bobolo), sauce verte et piment ; petit gril fumant à côté, le Respo se frotte les mains. |

### Plats du jour du Restaurant du Mboa

| Fichier | Utilisé pour | Description de la scène |
|---|---|---|
| `menu-eru.jpg` | Eru · water fufu | Assiette d'eru (feuilles vertes finement coupées, huile de palme, morceaux de viande et de peau de bœuf) avec une boule de water fufu blanc. |
| `menu-koki.jpg` | Koki · plantain mûr | Gâteau de haricots jaune-orangé (koki) démoulé de sa feuille de bananier, avec des tranches de plantain mûr. |
| `menu-okok.jpg` | Okok · bâton de manioc | Assiette d'okok (feuilles vert foncé à la pâte d'arachide) avec deux bâtons de manioc. |
| `menu-achu.jpg` | Achu · sauce jaune | Taro pilé disposé en couronne avec la sauce jaune au centre, morceaux de viande ; plat de fête. |
| `menu-mbongo.jpg` | Mbongo tchobi · poisson | Poisson dans une sauce noire épaisse (mbongo tchobi), servi avec du plantain vapeur. |
| `menu-kondre.jpg` | Kondrè de chèvre | Marmite de kondrè : plantains verts mijotés avec de la viande de chèvre, sauce orangée. |

Pour ces six plats, le Respo peut apparaître en petit derrière l'assiette (serviette autour du cou), mais le plat doit rester le sujet principal.

### Loisirs

| Fichier | Utilisé pour | Description de la scène |
|---|---|---|
| `menu-ludo.jpg` | Partie de ludo (Cité des palmiers, Mboa village) | Le Respo et un voisin penchés sur un plateau de ludo coloré posé sur un tabouret ; le Respo jette le dé en criant de joie. |
| `menu-songo.jpg` | Partie de songo (Mboa village) | Le Respo assis par terre face à un vieil homme, entre eux un plateau de songo en bois à cases creusées avec des graines ; concentration exagérée. |
| `menu-lions.jpg` | Match des Lions au bar (Club, Rue du Njoka) | Le Respo debout devant un vieux téléviseur dans un bar, maillot vert-rouge-jaune par-dessus la chemise, bras levés, autres supporters qui crient. |
| `menu-cabaret.jpg` | Soirée cabaret (Rue du Njoka) | Scène de cabaret : un chanteur au micro et un guitariste, le Respo danse devant, cravate nouée autour de la tête ; projecteurs colorés. |

### Vie sociale

| Fichier | Utilisé pour | Description de la scène |
|---|---|---|
| `menu-tontine.jpg` | Réunion de la tontine (Cité des palmiers) | Cercle de chaises en plastique, une calebasse ou une cuvette pleine de billets au centre ; le Respo y dépose sa cotisation, une trésorière note dans un cahier. |
| `menu-mariage.jpg` | Mariage au village (Mboa village) | Mariés en tenue de pagne assorti, le Respo leur tend une enveloppe en dansant ; confettis. |
| `menu-deuil.jpg` | Deuil au quartier (Mboa village) | Scène sobre et respectueuse : tente de deuil, chaises en plastique, le Respo en vêtements sombres présente ses condoléances à une famille. Pas de caricature moqueuse ici. |

## Vérifier une image

Ouvrir le lieu concerné dans le jeu : la carte de l'activité doit afficher la nouvelle image à gauche.
Si l'image de secours apparaît encore, vérifier le nom du fichier (minuscules, tiret, extension `.jpg`).
