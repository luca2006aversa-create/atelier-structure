# -*- coding: utf-8 -*-
"""Atelier structure -> Grasshopper (composant GhPython).

Entree  : fichier   (texte, Item)      le .json enregistre par le site
          volumes_on (booleen, Item)   construire les volumes ou seulement les axes

Sorties : axes      lignes d'axe de chaque barre, un jeu par portique
          volumes   les memes barres en solides, a leur vraie section
          pieces    "poteau", "poutre", "membrure"... (meme ordre que axes)
          matieres  nom de la matiere (meme ordre)
          sections  "12 x 40 cm" (meme ordre)
          nappes    toits et dalles en solides
          infos     entraxe, nombre de portiques, nombre de barres

A faire une fois : poser un composant GhPython, renommer les entrees et sorties
comme ci-dessus, coller ce code, puis brancher un panneau avec le chemin du .json.
Les axes suffisent pour tout refaire autrement : trame, variantes, optimisation.
"""

import json

import Rhino
import Rhino.Geometry as G

TOL = 0.001


def _echelle():
    doc = Rhino.RhinoDoc.ActiveDoc
    if doc is None:
        return 1.0
    return Rhino.RhinoMath.UnitScale(Rhino.UnitSystem.Meters, doc.ModelUnitSystem)


def _point(x, y, z, k):
    """Repere du site (x = largeur, y = hauteur, z = profondeur) -> Rhino, z vers le haut."""
    return G.Point3d(x * k, z * k, y * k)


def _ferme(pts):
    p = list(pts)
    if p[0].DistanceTo(p[-1]) > 1e-9:
        p.append(p[0])
    return G.PolylineCurve(p)


def _solide(profil, vecteur, cap=True):
    srf = G.Surface.CreateExtrusion(profil, vecteur)
    if srf is None:
        return None
    brep = srf.ToBrep()
    if brep is None:
        return None
    if cap:
        plein = brep.CapPlanarHoles(TOL)
        if plein is not None:
            return plein
    return brep


def _barre(bar, z, k, faire_volume):
    ax, ay = bar["a"]
    cx, cy = bar["c"]
    A = _point(ax, ay, z, k)
    C = _point(cx, cy, z, k)
    axe = G.Line(A, C)
    if not faire_volume or A.DistanceTo(C) < 1e-9:
        return axe, None
    v = C - A
    u = G.Vector3d(v)
    u.Unitize()
    larg = float(bar["b"]) * k
    haut = float(bar["h"]) * k
    if bar.get("forme") in ("rond", "tube"):
        profil = G.ArcCurve(G.Circle(G.Plane(A, u), max(larg, 1e-4) / 2.0))
    else:
        n = G.Vector3d(-(cy - ay), 0, (cx - ax))
        if not n.Unitize():
            return axe, None
        w = G.Vector3d(0, 1, 0)
        coins = [A + n * (s * haut / 2.0) + w * (t * larg / 2.0)
                 for s, t in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
        profil = _ferme(coins)
    return axe, _solide(profil, v)


def _section(bar):
    if bar.get("profil"):
        return str(bar["profil"])
    if bar.get("forme") in ("rond", "tube"):
        return "D %d mm" % round(bar["b"] * 1000)
    return "%d x %d cm" % (round(bar["b"] * 100), round(bar["h"] * 100))


def lire(chemin, faire_volume=True):
    with open(chemin, "r") as fh:
        d = json.load(fh)
    if d.get("format") != "atelier-structure":
        raise ValueError("Ce fichier ne vient pas de l'Atelier structure.")
    k = _echelle()
    mats = d.get("matieres", {})
    P = d.get("portiques", {})
    zs = P.get("z", [0.0])
    axes, vols, pieces, noms, secs = [], [], [], [], []
    for bar in d.get("barres", []):
        sec = _section(bar)
        nom = mats.get(bar.get("matiere"), {}).get("nom", bar.get("matiere", ""))
        for z in zs:
            axe, vol = _barre(bar, z, k, faire_volume)
            axes.append(axe)
            vols.append(vol)
            pieces.append(bar.get("piece", ""))
            noms.append(nom)
            secs.append(sec)
    nappes = []
    if faire_volume:
        z0 = P.get("z0", 0.0)
        z1 = P.get("z1", 0.0)
        for nap in d.get("nappes", []):
            pts = [_point(x, y, z0, k) for x, y in nap["contour"]]
            nappes.append(_solide(_ferme(pts), G.Vector3d(0, (z1 - z0) * k, 0)))
    infos = "%s : %d barres, %d portiques tous les %s m" % (
        d.get("feuille", "?"), len(d.get("barres", [])), P.get("nombre", 1), P.get("entraxe", "?"))
    return axes, vols, pieces, noms, secs, nappes, infos


# ---------- Branchement du composant ----------
axes, volumes, pieces, matieres, sections, nappes, infos = [], [], [], [], [], [], ""
try:
    if fichier:
        axes, volumes, pieces, matieres, sections, nappes, infos = lire(
            fichier, True if volumes_on is None else bool(volumes_on))
except Exception as err:  # le composant reste orange au lieu de planter
    infos = "Erreur : %s" % err
