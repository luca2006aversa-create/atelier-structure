# Atelier structure → Rhino / Grasshopper

Le site ne sait pas parler à Rhino tout seul : il enregistre un petit fichier
`.json` qui décrit la structure (un axe, une section, une matière par barre),
et un des trois scripts d'ici la rebâtit en volumes.

```
Atelier structure (navigateur)
      │  bouton « Envoyer vers Rhino » dans la carte 3D
      ▼
  Ma feuille.structure.json
      │
      ├──→ importer_structure.py   → volumes dans le Rhino déjà ouvert
      ├──→ structure_gh.py         → axes + volumes pilotables dans Grasshopper
      └──→ construire_3dm.py       → un fichier .3dm, sans ouvrir Rhino
```

## Ce que contient le `.json`

Tout est en **mètres**. Repère du site : `x` = largeur, `y` = hauteur,
`z` = profondeur. Les scripts convertissent en repère Rhino (`z` vers le haut).

| Clé | Contenu |
| --- | --- |
| `barres` | une par pièce : `piece`, `matiere`, `forme`, `b` (largeur hors plan), `h` (hauteur dans le plan), `a` et `c` (les deux bouts) |
| `portiques` | `entraxe`, `nombre`, et la liste des profondeurs `z` où répéter la coupe |
| `nappes` | toits et dalles : le contour de la coupe |
| `toiles` | les bâches : une ligne, pas de volume |
| `pannes` | où poser une panne (`p`), et son contour posé sur la poutre (`contour`) ; section dans `panne` |
| `moise` (dans une barre) | moise : deux pièces décalées de ± cette valeur en z |
| `matieres` | nom, couleur, densité, module de chaque matière citée |

Les axes seuls suffisent pour tout refaire autrement : trame, variantes,
optimisation. C'est fait pour ça.

## 1. Vers Rhino (le plus simple)

1. Dans Rhino : commande `_RunPythonScript`
2. Choisir `importer_structure.py`
3. Choisir le `.json`

Résultat : un calque `Structure::Poteaux`, `Structure::Poutres`, etc., la
couleur de la matière sur le calque, et sur chaque objet la pièce, la matière
et la section (Propriétés → Attributs utilisateur).
L'échelle du document est respectée (mètres, centimètres, millimètres).

## 2. Vers Grasshopper (pour piloter)

1. Poser un composant **GhPython** sur la toile
2. Renommer ses entrées : `fichier` (texte, Item), `volumes_on` (booléen, Item)
3. Renommer ses sorties : `axes`, `volumes`, `pieces`, `matieres`, `sections`,
   `nappes`, `infos`
4. Coller le contenu de `structure_gh.py`
5. Brancher un panneau avec le chemin du `.json`

`volumes_on` à faux → seulement les axes, ça va beaucoup plus vite pendant
qu'on cherche. Les sorties `pieces`, `matieres`, `sections` sont dans le même
ordre que `axes` : un `Dispatch` suffit pour trier.

## 3. Vers un fichier .3dm (sans ouvrir Rhino)

```
python construire_3dm.py "Ma feuille.structure.json" sortie.3dm [depart.3dm]
```

Le troisième argument est facultatif : un `.3dm` existant dont on garde les
calques et les réglages. C'est ce qui sert pour le fichier du projet :

```
python construire_3dm.py "Ma feuille.structure.json" D:\Archi\S5\atelier-structure.3dm D:\Archi\S5\atelier-structure.3dm
```

Il faut `rhino3dm` sur le Python du PC (`pip install rhino3dm`), pas Rhino.

## Un détail de géométrie

Une barre a deux largeurs : `h` est sa hauteur **dans le plan de la coupe**
(ce qu'on voit dessiné), `b` est son épaisseur **perpendiculaire** à la coupe.
Les trois scripts posent donc le profil orienté par la normale à l'axe, dans
le plan de la coupe — pas n'importe comment : une poutre 12 × 40 reste bien
haute de 40 cm, et pas couchée.
