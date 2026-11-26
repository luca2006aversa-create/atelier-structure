# -*- coding: utf-8 -*-
"""Atelier structure -> fichier .3dm, sans ouvrir Rhino.

    python construire_3dm.py structure.json sortie.3dm [modele_de_depart.3dm]

Fabrique les volumes (rhino3dm), les range par calque et ecrit la section
sur chaque objet. Utile pour envoyer le modele a quelqu'un, ou pour ouvrir
directement le resultat dans Rhino d'un double-clic.
"""

import json
import math
import os
import sys

import rhino3dm as r3

NOMS = {
    "poteau": "Poteaux",
    "poutre": "Poutres",
    "bequille": "Bequilles",
    "membrure": "Treillis",
    "diagonale": "Treillis",
    "entretoise": "Entretoises",
    "cable": "Cables",
    "toit": "Toits",
    "dalle": "Dalles",
    "toile": "Toiles",
    "panne": "Pannes",
}


def couleur(hexa):
    h = (hexa or "#cccccc").lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    try:
        return (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 255)
    except ValueError:
        return (200, 200, 200, 255)


def point(x, y, z):
    """Repere du site (x = largeur, y = hauteur, z = profondeur) -> Rhino, z vers le haut."""
    return r3.Point3d(x, z, y)


def profil_rect(b, h):
    p = r3.Polyline()
    for x, y in ((-b / 2, -h / 2), (b / 2, -h / 2), (b / 2, h / 2), (-b / 2, h / 2), (-b / 2, -h / 2)):
        p.Add(x, y, 0)
    return p.ToPolylineCurve()


def profil_rond(d):
    return r3.Circle(max(d, 1e-4) / 2.0).ToNurbsCurve()


def tirer(profil, A, C, up):
    """Un profil 2D pose en A, tire jusqu'en C, sa hauteur orientee par up."""
    e = r3.Extrusion()
    if not e.SetPathAndUp(A, C, up):
        return None
    if not e.SetOuterProfile(profil, True):
        return None
    return e


def barre(bar, z):
    ax, ay = bar["a"]
    cx, cy = bar["c"]
    A = point(ax, ay, z)
    C = point(cx, cy, z)
    if A.DistanceTo(C) < 1e-9:
        return None
    # Normale dans le plan de la coupe : c'est le sens de la hauteur de section.
    n = r3.Vector3d(-(cy - ay), 0, (cx - ax))
    L = math.hypot(n.X, n.Z)
    if L < 1e-12:
        return None
    up = r3.Vector3d(n.X / L, 0, n.Z / L)
    if bar.get("forme") in ("rond", "tube"):
        return tirer(profil_rond(bar["b"]), A, C, up)
    return tirer(profil_rect(bar["b"], bar["h"]), A, C, up)


def nappe(contour, z0, z1):
    """Un toit ou une dalle : le contour de la coupe, tire en profondeur."""
    p = r3.Polyline()
    for x, y in contour:
        p.Add(x, z0, y)
    if p[0].DistanceTo(p[len(p) - 1]) > 1e-9:
        p.Add(p[0].X, p[0].Y, p[0].Z)
    crv = p.ToPolylineCurve()
    e = r3.Extrusion()
    A = r3.Point3d(0, z0, 0)
    C = r3.Point3d(0, z1, 0)
    if A.DistanceTo(C) < 1e-9:
        return None
    # Profil deja pose dans l'espace : on passe par une extrusion le long de Y.
    return r3.Extrusion.Create(crv, z1 - z0, True)


def panne(p, b, h, z0, z1):
    x, y = p
    A = point(x, y, z0)
    C = point(x, y, z1)
    if A.DistanceTo(C) < 1e-9:
        return None
    return tirer(profil_rect(b, h), A, C, r3.Vector3d(0, 0, 1))


def section_texte(bar):
    if bar.get("profil"):
        return str(bar["profil"])
    if bar.get("forme") in ("rond", "tube"):
        return "D %d mm" % round(bar["b"] * 1000)
    return "%d x %d cm" % (round(bar["b"] * 100), round(bar["h"] * 100))


def construire(chemin_json, chemin_3dm, depart=None):
    with open(chemin_json, "r", encoding="utf-8") as fh:
        d = json.load(fh)
    if d.get("format") != "atelier-structure":
        raise SystemExit("Ce fichier ne vient pas de l'Atelier structure.")

    # Un fichier de depart garde ses calques et ses reglages ; sinon on part de zero.
    doc = r3.File3dm.Read(depart) if depart else r3.File3dm()
    if doc is None:
        raise SystemExit("Fichier de depart illisible : %s" % depart)
    doc.Settings.ModelUnitSystem = r3.UnitSystem.Meters
    mats = d.get("matieres", {})
    P = d.get("portiques", {})
    zs = P.get("z", [0.0])
    z0 = P.get("z0", 0.0)
    z1 = P.get("z1", 0.0)
    # On reprend les calques deja presents dans le fichier de depart.
    calques = {}
    for i, c in enumerate(doc.Layers):
        calques.setdefault(c.Name, i)

    def calque(piece, mat):
        nom = NOMS.get(piece, piece.capitalize())
        if nom not in calques:
            c = r3.Layer()
            c.Name = nom
            c.Color = couleur(mats.get(mat, {}).get("couleur"))
            calques[nom] = doc.Layers.Add(c)
        return calques[nom]

    def poser(geo, piece, mat, sec):
        if geo is None:
            return 0
        at = r3.ObjectAttributes()
        at.LayerIndex = calque(piece, mat)
        at.Name = NOMS.get(piece, piece)
        at.SetUserString("piece", piece)
        at.SetUserString("matiere", mats.get(mat, {}).get("nom", str(mat)))
        if sec:
            at.SetUserString("section", sec)
        doc.Objects.Add(geo, at)
        return 1

    n = 0
    for bar in d.get("barres", []):
        sec = section_texte(bar)
        m = bar.get("moise") or 0  # moise : une piece de chaque cote, decalee de +/- m
        for z in zs:
            for dz in ((-m, m) if m else (0,)):
                n += poser(barre(bar, z + dz), bar.get("piece", "poutre"), bar.get("matiere"), sec)
    for nap in d.get("nappes", []):
        n += poser(nappe(nap["contour"], z0, z1), nap.get("type", "toit"), nap.get("matiere"), "")
    pa = d.get("panne", {})
    for p in d.get("pannes", []):
        if p.get("contour"):  # posee sur la poutre, tournee comme elle
            g = nappe(p["contour"], pa.get("z0", z0), pa.get("z1", z1))
        else:
            g = panne(p["p"], pa.get("b", 0.08), pa.get("h", 0.16), pa.get("z0", z0), pa.get("z1", z1))
        n += poser(g, "panne", pa.get("matiere", "c24"), "8 x 16 cm")

    doc.Write(chemin_3dm, 7)
    return n, d


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return
    entree = sys.argv[1]
    sortie = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(entree)[0] + ".3dm"
    depart = sys.argv[3] if len(sys.argv) > 3 else None
    n, d = construire(entree, sortie, depart)
    P = d.get("portiques", {})
    print("%s : %d volumes." % (os.path.basename(sortie), n))
    print("Feuille %s, %d portiques tous les %s m." % (d.get("feuille", "?"), P.get("nombre", 1), P.get("entraxe", "?")))


if __name__ == "__main__":
    main()
