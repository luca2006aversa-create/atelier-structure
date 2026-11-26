# -*- coding: utf-8 -*-
"""Atelier structure -> Rhino.

Lit le fichier .json enregistre par le site et rebatit la structure en volumes :
un calque par type de piece, la couleur de la matiere, et la section ecrite
sur chaque objet (Proprietes > Attributs utilisateur).

Dans Rhino : _RunPythonScript, choisir ce fichier, puis choisir le .json.
"""

import json
import os

import Rhino
import rhinoscriptsyntax as rs
import scriptcontext as sc

G = Rhino.Geometry

# Nom lisible de chaque piece, pour les calques.
NOMS = {
    "poteau": "Poteaux",
    "poutre": "Poutres",
    "bequille": "Bequilles",
    "membrure": "Membrures",
    "diagonale": "Diagonales",
    "entretoise": "Entretoises",
    "cable": "Cables",
    "toit": "Toits",
    "dalle": "Dalles",
    "toile": "Toiles",
    "panne": "Pannes",
}
RACINE = "Structure"


def echelle():
    """Le fichier est en metres ; le document Rhino peut etre en autre chose."""
    return Rhino.RhinoMath.UnitScale(Rhino.UnitSystem.Meters, sc.doc.ModelUnitSystem)


def point(x, y, z, k):
    """Repere du site (x = largeur, y = hauteur, z = profondeur) -> Rhino, z vers le haut."""
    return G.Point3d(x * k, z * k, y * k)


def couleur(hexa):
    h = (hexa or "#cccccc").lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    except ValueError:
        return (200, 200, 200)


def calque(piece, col):
    nom = RACINE + "::" + NOMS.get(piece, piece.capitalize())
    if not rs.IsLayer(RACINE):
        rs.AddLayer(RACINE)
    if not rs.IsLayer(nom):
        rs.AddLayer(nom, col, parent=RACINE)
    return nom


def ferme(pts):
    p = list(pts)
    if p[0].DistanceTo(p[-1]) > 1e-9:
        p.append(p[0])
    return G.PolylineCurve(p)


def solide(profil, vecteur, cap=True):
    srf = G.Surface.CreateExtrusion(profil, vecteur)
    if srf is None:
        return None
    brep = srf.ToBrep()
    if brep is None:
        return None
    if cap:
        plein = brep.CapPlanarHoles(sc.doc.ModelAbsoluteTolerance)
        if plein is not None:
            return plein
    return brep


def volume_barre(bar, zprof, k):
    """Une barre : son profil pose a une extremite, tire jusqu'a l'autre."""
    ax, ay = bar["a"]
    cx, cy = bar["c"]
    A = point(ax, ay, zprof, k)
    C = point(cx, cy, zprof, k)
    axe = C - A
    L = axe.Length
    if L < 1e-9:
        return None
    u = G.Vector3d(axe)
    u.Unitize()
    larg = float(bar["b"]) * k   # perpendiculaire au plan de la coupe
    haut = float(bar["h"]) * k   # dans le plan de la coupe
    forme = bar.get("forme", "rect")
    if forme in ("rond", "tube"):
        cercle = G.Circle(G.Plane(A, u), max(larg, 1e-4) / 2.0)
        profil = G.ArcCurve(cercle)
    else:
        n = G.Vector3d(-(cy - ay), 0, (cx - ax))
        if not n.Unitize():
            return None
        w = G.Vector3d(0, 1, 0)
        coins = []
        for s, t in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            coins.append(A + n * (s * haut / 2.0) + w * (t * larg / 2.0))
        profil = ferme(coins)
    return solide(profil, axe)


def volume_nappe(contour, z0, z1, k):
    pts = [point(x, y, z0, k) for x, y in contour]
    return solide(ferme(pts), G.Vector3d(0, (z1 - z0) * k, 0))


def surface_toile(ligne, z0, z1, k):
    pts = [point(x, y, z0, k) for x, y in ligne]
    return solide(G.PolylineCurve(pts), G.Vector3d(0, (z1 - z0) * k, 0), cap=False)


def volume_panne(p, b, h, z0, z1, k):
    x, y = p
    coins = [
        point(x - b / 2.0, y - h / 2.0, z0, k),
        point(x + b / 2.0, y - h / 2.0, z0, k),
        point(x + b / 2.0, y + h / 2.0, z0, k),
        point(x - b / 2.0, y + h / 2.0, z0, k),
    ]
    return solide(ferme(coins), G.Vector3d(0, (z1 - z0) * k, 0))


def poser(brep, piece, mat, matieres, etiquettes):
    if brep is None:
        return 0
    m = matieres.get(mat, {})
    oid = sc.doc.Objects.AddBrep(brep)
    if oid is None or oid == Rhino.DocObjects.RhinoObject.UnsetObjectId:
        return 0
    rs.ObjectLayer(oid, calque(piece, couleur(m.get("couleur"))))
    rs.ObjectName(oid, NOMS.get(piece, piece) + " " + (etiquettes or ""))
    rs.SetUserText(oid, "piece", piece)
    rs.SetUserText(oid, "matiere", m.get("nom", mat))
    if etiquettes:
        rs.SetUserText(oid, "section", etiquettes)
    return 1


def section_texte(bar):
    if bar.get("profil"):
        return str(bar["profil"])
    if bar.get("forme") in ("rond", "tube"):
        return "D %d mm" % round(bar["b"] * 1000)
    return "%d x %d cm" % (round(bar["b"] * 100), round(bar["h"] * 100))


def main():
    chemin = rs.OpenFileName("Structure a importer", "Atelier structure (*.json)|*.json||")
    if not chemin:
        return
    with open(chemin, "r") as fh:
        d = json.load(fh)
    if d.get("format") != "atelier-structure":
        print("Ce fichier ne vient pas de l'Atelier structure.")
        return

    k = echelle()
    mats = d.get("matieres", {})
    P = d.get("portiques", {})
    zs = P.get("z", [0.0])
    z0 = P.get("z0", 0.0)
    z1 = P.get("z1", 0.0)
    n = 0

    rs.EnableRedraw(False)
    try:
        for bar in d.get("barres", []):
            etiq = section_texte(bar)
            m = bar.get("moise") or 0  # moise : une piece de chaque cote, decalee de +/- m
            for z in zs:
                for dz in ((-m, m) if m else (0,)):
                    n += poser(volume_barre(bar, z + dz, k), bar.get("piece", "poutre"), bar.get("matiere"), mats, etiq)
        for nap in d.get("nappes", []):
            n += poser(volume_nappe(nap["contour"], z0, z1, k), nap.get("type", "toit"), nap.get("matiere"), mats, "")
        for t in d.get("toiles", []):
            n += poser(surface_toile(t["ligne"], z0, z1, k), "toile", t.get("matiere"), mats, "")
        pa = d.get("panne", {})
        for p in d.get("pannes", []):
            if p.get("contour"):  # posee sur la poutre, tournee comme elle
                brep = volume_nappe(p["contour"], pa.get("z0", z0), pa.get("z1", z1), k)
            else:
                brep = volume_panne(p["p"], pa.get("b", 0.08), pa.get("h", 0.16), pa.get("z0", z0), pa.get("z1", z1), k)
            n += poser(brep, "panne", pa.get("matiere", "c24"), mats, "8 x 16 cm")
    finally:
        rs.EnableRedraw(True)
        sc.doc.Views.Redraw()

    print("%s : %d volumes poses." % (os.path.basename(chemin), n))
    print("Feuille %s, %d portiques tous les %s m." % (d.get("feuille", "?"), P.get("nombre", 1), P.get("entraxe", "?")))


if __name__ == "__main__":
    main()
