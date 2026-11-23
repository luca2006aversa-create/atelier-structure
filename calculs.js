// Resultats du calcul de structure. Fichier ECRIT PAR UN SCRIPT :
// ne pas modifier a la main, relancer D:/Archi/S5/07_structure/vers_site.py
// Source : descente_de_charges.py (Eurocode 5, GL24h) - 2026-11-22

export const CALC = {
 "charges_kN_m2": {
  "G hors structure": 0.6,
  "G solives": 0.124,
  "G ferme": 0.414,
  "G total": 1.137,
  "Neige S": 0.36,
  "ELU 1,35G+1,5S": 2.076
 },
 "ferme": {
  "portee_m": 35.0,
  "hauteur_m": 1.5,
  "elancement": 23.3,
  "sous_face_m": 9.7,
  "haut_toiture_m": 11.7,
  "volume_bois_m3": 17.58,
  "poids_kN": 72.4,
  "charge_totale_ELU_kN": 363.2
 },
 "barres": {
  "membrure haute": {
   "traction_max_kN": 5.4,
   "compression_max_kN": -1324.6,
   "taux_max": 0.548,
   "mode_dimensionnant": "compression",
   "sigma_MPa": 8.28,
   "kc": 0.984
  },
  "membrure basse": {
   "traction_max_kN": 1344.6,
   "compression_max_kN": 0.0,
   "taux_max": 0.684,
   "mode_dimensionnant": "traction",
   "sigma_MPa": 8.4,
   "kc": 1.0
  },
  "montant": {
   "traction_max_kN": 160.1,
   "compression_max_kN": -14.1,
   "taux_max": 0.118,
   "mode_dimensionnant": "traction",
   "sigma_MPa": 1.46,
   "kc": 1.0
  },
  "diagonale": {
   "traction_max_kN": 0.0,
   "compression_max_kN": -445.7,
   "taux_max": 0.296,
   "mode_dimensionnant": "compression",
   "sigma_MPa": 4.05,
   "kc": 0.893
  }
 },
 "fleches_mm": {
  "instantanee": 139.0,
  "limite_instantanee_L_300": 116.7,
  "finale_avec_fluage": 202.3,
  "limite_finale_L_200": 175.0,
  "taux_instantanee": 1.19,
  "taux_finale": 1.16
 },
 "descente": {
  "reaction_ferme_ELU_kN": 186.7,
  "poussee_horizontale_kN": 0.0,
  "poids_poteau_incline_kN": 18.7,
  "N_poteau_ELU_kN": 219.0,
  "sigma_poteau_MPa": 0.63,
  "kc_poteau": 0.926,
  "taux_poteau": 0.044,
  "N_fondation_ELS_kN": 151.2,
  "semelle_m2": 0.76,
  "semelle_cote_m": 0.87,
  "hypothese_sol_kPa": 200.0
 },
 "solives": {
  "portee_m": 5.0,
  "moment_ELU_kNm": 11.9,
  "sigma_MPa": 1.9,
  "fm_d_MPa": 15.36,
  "taux": 0.123,
  "fleche_ELS_mm": 1.2,
  "limite_L_300_mm": 16.7
 },
 "totaux": {
  "surface_toiture_m2": 1575.0,
  "G_total_kN": 1792.0,
  "neige_totale_kN": 567.0,
  "volume_bois_fermes_m3": 175.8
 },
 "resistances_MPa": {
  "ft_0_d": 12.29,
  "fc_0_d": 15.36,
  "fm_d": 15.36,
  "kmod": 0.8,
  "gamma_M": 1.25
 },
 "verdict": {
  "resistance_ok": true,
  "taux_resistance_max": 0.684,
  "fleche_ok": false
 }
};

export const BALAYAGE = [
 {
  "h_ferme_m": 1.5,
  "elancement": 23.3,
  "libre_m": 9.7,
  "haut_toiture_m": 11.7,
  "taux_resistance": 0.684,
  "taux_fleche_inst": 1.19,
  "taux_fleche_fin": 1.16,
  "fleche_fin_mm": 202.3,
  "bois_m3_par_ferme": 17.58,
  "ok": false
 },
 {
  "h_ferme_m": 1.6,
  "elancement": 21.9,
  "libre_m": 9.63,
  "haut_toiture_m": 11.73,
  "taux_resistance": 0.633,
  "taux_fleche_inst": 1.02,
  "taux_fleche_fin": 0.99,
  "fleche_fin_mm": 173.3,
  "bois_m3_par_ferme": 17.83,
  "ok": false
 },
 {
  "h_ferme_m": 1.7,
  "elancement": 20.6,
  "libre_m": 9.56,
  "haut_toiture_m": 11.76,
  "taux_resistance": 0.589,
  "taux_fleche_inst": 0.88,
  "taux_fleche_fin": 0.86,
  "fleche_fin_mm": 150.4,
  "bois_m3_par_ferme": 18.09,
  "ok": true
 },
 {
  "h_ferme_m": 1.8,
  "elancement": 19.4,
  "libre_m": 9.49,
  "haut_toiture_m": 11.79,
  "taux_resistance": 0.551,
  "taux_fleche_inst": 0.78,
  "taux_fleche_fin": 0.75,
  "fleche_fin_mm": 131.9,
  "bois_m3_par_ferme": 18.35,
  "ok": true
 },
 {
  "h_ferme_m": 1.9,
  "elancement": 18.4,
  "libre_m": 9.42,
  "haut_toiture_m": 11.82,
  "taux_resistance": 0.518,
  "taux_fleche_inst": 0.69,
  "taux_fleche_fin": 0.67,
  "fleche_fin_mm": 116.8,
  "bois_m3_par_ferme": 18.61,
  "ok": true
 },
 {
  "h_ferme_m": 2.0,
  "elancement": 17.5,
  "libre_m": 9.35,
  "haut_toiture_m": 11.85,
  "taux_resistance": 0.489,
  "taux_fleche_inst": 0.61,
  "taux_fleche_fin": 0.6,
  "fleche_fin_mm": 104.3,
  "bois_m3_par_ferme": 18.88,
  "ok": true
 },
 {
  "h_ferme_m": 2.1,
  "elancement": 16.7,
  "libre_m": 9.28,
  "haut_toiture_m": 11.88,
  "taux_resistance": 0.463,
  "taux_fleche_inst": 0.55,
  "taux_fleche_fin": 0.54,
  "fleche_fin_mm": 93.9,
  "bois_m3_par_ferme": 19.16,
  "ok": true
 },
 {
  "h_ferme_m": 2.2,
  "elancement": 15.9,
  "libre_m": 9.21,
  "haut_toiture_m": 11.91,
  "taux_resistance": 0.44,
  "taux_fleche_inst": 0.5,
  "taux_fleche_fin": 0.49,
  "fleche_fin_mm": 85.1,
  "bois_m3_par_ferme": 19.43,
  "ok": true
 },
 {
  "h_ferme_m": 2.3,
  "elancement": 15.2,
  "libre_m": 9.14,
  "haut_toiture_m": 11.94,
  "taux_resistance": 0.42,
  "taux_fleche_inst": 0.46,
  "taux_fleche_fin": 0.44,
  "fleche_fin_mm": 77.6,
  "bois_m3_par_ferme": 19.72,
  "ok": true
 },
 {
  "h_ferme_m": 2.4,
  "elancement": 14.6,
  "libre_m": 9.07,
  "haut_toiture_m": 11.97,
  "taux_resistance": 0.401,
  "taux_fleche_inst": 0.42,
  "taux_fleche_fin": 0.41,
  "fleche_fin_mm": 71.1,
  "bois_m3_par_ferme": 20.0,
  "ok": true
 },
 {
  "h_ferme_m": 2.5,
  "elancement": 14.0,
  "libre_m": 9.0,
  "haut_toiture_m": 12.0,
  "taux_resistance": 0.384,
  "taux_fleche_inst": 0.38,
  "taux_fleche_fin": 0.37,
  "fleche_fin_mm": 65.5,
  "bois_m3_par_ferme": 20.29,
  "ok": true
 },
 {
  "h_ferme_m": 2.6,
  "elancement": 13.5,
  "libre_m": 9.0,
  "haut_toiture_m": 12.1,
  "taux_resistance": 0.369,
  "taux_fleche_inst": 0.36,
  "taux_fleche_fin": 0.35,
  "fleche_fin_mm": 60.7,
  "bois_m3_par_ferme": 20.58,
  "ok": true
 },
 {
  "h_ferme_m": 2.7,
  "elancement": 13.0,
  "libre_m": 9.0,
  "haut_toiture_m": 12.2,
  "taux_resistance": 0.354,
  "taux_fleche_inst": 0.33,
  "taux_fleche_fin": 0.32,
  "fleche_fin_mm": 56.5,
  "bois_m3_par_ferme": 20.88,
  "ok": true
 },
 {
  "h_ferme_m": 2.8,
  "elancement": 12.5,
  "libre_m": 9.0,
  "haut_toiture_m": 12.3,
  "taux_resistance": 0.341,
  "taux_fleche_inst": 0.31,
  "taux_fleche_fin": 0.3,
  "fleche_fin_mm": 52.7,
  "bois_m3_par_ferme": 21.18,
  "ok": true
 },
 {
  "h_ferme_m": 2.9,
  "elancement": 12.1,
  "libre_m": 9.0,
  "haut_toiture_m": 12.4,
  "taux_resistance": 0.329,
  "taux_fleche_inst": 0.29,
  "taux_fleche_fin": 0.28,
  "fleche_fin_mm": 49.4,
  "bois_m3_par_ferme": 21.48,
  "ok": true
 },
 {
  "h_ferme_m": 3.0,
  "elancement": 11.7,
  "libre_m": 9.0,
  "haut_toiture_m": 12.5,
  "taux_resistance": 0.318,
  "taux_fleche_inst": 0.27,
  "taux_fleche_fin": 0.27,
  "fleche_fin_mm": 46.5,
  "bois_m3_par_ferme": 21.78,
  "ok": true
 },
 {
  "h_ferme_m": 3.1,
  "elancement": 11.3,
  "libre_m": 9.0,
  "haut_toiture_m": 12.6,
  "taux_resistance": 0.308,
  "taux_fleche_inst": 0.26,
  "taux_fleche_fin": 0.25,
  "fleche_fin_mm": 43.9,
  "bois_m3_par_ferme": 22.08,
  "ok": true
 },
 {
  "h_ferme_m": 3.2,
  "elancement": 10.9,
  "libre_m": 9.0,
  "haut_toiture_m": 12.7,
  "taux_resistance": 0.298,
  "taux_fleche_inst": 0.24,
  "taux_fleche_fin": 0.24,
  "fleche_fin_mm": 41.6,
  "bois_m3_par_ferme": 22.39,
  "ok": true
 },
 {
  "h_ferme_m": 3.3,
  "elancement": 10.6,
  "libre_m": 9.0,
  "haut_toiture_m": 12.8,
  "taux_resistance": 0.29,
  "taux_fleche_inst": 0.23,
  "taux_fleche_fin": 0.23,
  "fleche_fin_mm": 39.5,
  "bois_m3_par_ferme": 22.7,
  "ok": true
 },
 {
  "h_ferme_m": 3.4,
  "elancement": 10.3,
  "libre_m": 9.0,
  "haut_toiture_m": 12.9,
  "taux_resistance": 0.281,
  "taux_fleche_inst": 0.22,
  "taux_fleche_fin": 0.21,
  "fleche_fin_mm": 37.6,
  "bois_m3_par_ferme": 23.01,
  "ok": true
 },
 {
  "h_ferme_m": 3.5,
  "elancement": 10.0,
  "libre_m": 9.0,
  "haut_toiture_m": 13.0,
  "taux_resistance": 0.276,
  "taux_fleche_inst": 0.21,
  "taux_fleche_fin": 0.21,
  "fleche_fin_mm": 35.9,
  "bois_m3_par_ferme": 23.32,
  "ok": true
 },
 {
  "h_ferme_m": 3.6,
  "elancement": 9.7,
  "libre_m": 9.0,
  "haut_toiture_m": 13.1,
  "taux_resistance": 0.282,
  "taux_fleche_inst": 0.2,
  "taux_fleche_fin": 0.2,
  "fleche_fin_mm": 34.4,
  "bois_m3_par_ferme": 23.64,
  "ok": true
 }
];

export const BARRES = [
 {
  "famille": "membrure basse",
  "y1": -15891.7,
  "z1": 9860.0,
  "y2": -13391.7,
  "z2": 9860.0,
  "N_kN": 420.0,
  "taux": 0.214
 },
 {
  "famille": "membrure basse",
  "y1": -13391.7,
  "z1": 9860.0,
  "y2": -10891.7,
  "z2": 9860.0,
  "N_kN": 711.5,
  "taux": 0.362
 },
 {
  "famille": "membrure basse",
  "y1": -10891.7,
  "z1": 9860.0,
  "y2": -8391.7,
  "z2": 9860.0,
  "N_kN": 948.1,
  "taux": 0.482
 },
 {
  "famille": "membrure basse",
  "y1": -8391.7,
  "z1": 9860.0,
  "y2": -5891.7,
  "z2": 9860.0,
  "N_kN": 1129.7,
  "taux": 0.575
 },
 {
  "famille": "membrure basse",
  "y1": -5891.7,
  "z1": 9860.0,
  "y2": -3391.7,
  "z2": 9860.0,
  "N_kN": 1256.3,
  "taux": 0.639
 },
 {
  "famille": "membrure basse",
  "y1": -3391.7,
  "z1": 9860.0,
  "y2": -891.7,
  "z2": 9860.0,
  "N_kN": 1327.9,
  "taux": 0.675
 },
 {
  "famille": "membrure basse",
  "y1": -891.7,
  "z1": 9860.0,
  "y2": 1608.3,
  "z2": 9860.0,
  "N_kN": 1344.6,
  "taux": 0.684
 },
 {
  "famille": "membrure basse",
  "y1": 1608.3,
  "z1": 9860.0,
  "y2": 4108.3,
  "z2": 9860.0,
  "N_kN": 1344.6,
  "taux": 0.684
 },
 {
  "famille": "membrure basse",
  "y1": 4108.3,
  "z1": 9860.0,
  "y2": 6608.3,
  "z2": 9860.0,
  "N_kN": 1306.3,
  "taux": 0.664
 },
 {
  "famille": "membrure basse",
  "y1": 6608.3,
  "z1": 9860.0,
  "y2": 9108.3,
  "z2": 9860.0,
  "N_kN": 1213.0,
  "taux": 0.617
 },
 {
  "famille": "membrure basse",
  "y1": 9108.3,
  "z1": 9860.0,
  "y2": 11608.3,
  "z2": 9860.0,
  "N_kN": 1064.8,
  "taux": 0.542
 },
 {
  "famille": "membrure basse",
  "y1": 11608.3,
  "z1": 9860.0,
  "y2": 14108.3,
  "z2": 9860.0,
  "N_kN": 861.6,
  "taux": 0.438
 },
 {
  "famille": "membrure basse",
  "y1": 14108.3,
  "z1": 9860.0,
  "y2": 16608.3,
  "z2": 9860.0,
  "N_kN": 603.4,
  "taux": 0.307
 },
 {
  "famille": "membrure basse",
  "y1": 16608.3,
  "z1": 9860.0,
  "y2": 19108.3,
  "z2": 9860.0,
  "N_kN": 290.3,
  "taux": 0.148
 },
 {
  "famille": "membrure haute",
  "y1": -15400.0,
  "z1": 11040.0,
  "y2": -12900.0,
  "z2": 11040.0,
  "N_kN": -5.4,
  "taux": 0.002
 },
 {
  "famille": "membrure haute",
  "y1": -12900.0,
  "z1": 11040.0,
  "y2": -10400.0,
  "z2": 11040.0,
  "N_kN": -362.7,
  "taux": 0.15
 },
 {
  "famille": "membrure haute",
  "y1": -10400.0,
  "z1": 11040.0,
  "y2": -7900.0,
  "z2": 11040.0,
  "N_kN": -665.0,
  "taux": 0.275
 },
 {
  "famille": "membrure haute",
  "y1": -7900.0,
  "z1": 11040.0,
  "y2": -5400.0,
  "z2": 11040.0,
  "N_kN": -912.4,
  "taux": 0.377
 },
 {
  "famille": "membrure haute",
  "y1": -5400.0,
  "z1": 11040.0,
  "y2": -2900.0,
  "z2": 11040.0,
  "N_kN": -1104.8,
  "taux": 0.457
 },
 {
  "famille": "membrure haute",
  "y1": -2900.0,
  "z1": 11040.0,
  "y2": -400.0,
  "z2": 11040.0,
  "N_kN": -1242.2,
  "taux": 0.514
 },
 {
  "famille": "membrure haute",
  "y1": -400.0,
  "z1": 11040.0,
  "y2": 2100.0,
  "z2": 11040.0,
  "N_kN": -1324.6,
  "taux": 0.548
 },
 {
  "famille": "membrure haute",
  "y1": 2100.0,
  "z1": 11040.0,
  "y2": 4600.0,
  "z2": 11040.0,
  "N_kN": -1313.8,
  "taux": 0.543
 },
 {
  "famille": "membrure haute",
  "y1": 4600.0,
  "z1": 11040.0,
  "y2": 7100.0,
  "z2": 11040.0,
  "N_kN": -1231.4,
  "taux": 0.509
 },
 {
  "famille": "membrure haute",
  "y1": 7100.0,
  "z1": 11040.0,
  "y2": 9600.0,
  "z2": 11040.0,
  "N_kN": -1094.0,
  "taux": 0.452
 },
 {
  "famille": "membrure haute",
  "y1": 9600.0,
  "z1": 11040.0,
  "y2": 12100.0,
  "z2": 11040.0,
  "N_kN": -901.6,
  "taux": 0.373
 },
 {
  "famille": "membrure haute",
  "y1": 12100.0,
  "z1": 11040.0,
  "y2": 14600.0,
  "z2": 11040.0,
  "N_kN": -654.2,
  "taux": 0.27
 },
 {
  "famille": "membrure haute",
  "y1": 14600.0,
  "z1": 11040.0,
  "y2": 17100.0,
  "z2": 11040.0,
  "N_kN": -351.9,
  "taux": 0.145
 },
 {
  "famille": "membrure haute",
  "y1": 17100.0,
  "z1": 11040.0,
  "y2": 19600.0,
  "z2": 11040.0,
  "N_kN": 5.4,
  "taux": 0.003
 },
 {
  "famille": "montant",
  "y1": -15891.7,
  "z1": 9860.0,
  "y2": -15400.0,
  "z2": 11040.0,
  "N_kN": -14.1,
  "taux": 0.008
 },
 {
  "famille": "montant",
  "y1": -13391.7,
  "z1": 9860.0,
  "y2": -12900.0,
  "z2": 11040.0,
  "N_kN": 149.1,
  "taux": 0.11
 },
 {
  "famille": "montant",
  "y1": -10891.7,
  "z1": 9860.0,
  "y2": -10400.0,
  "z2": 11040.0,
  "N_kN": 121.0,
  "taux": 0.089
 },
 {
  "famille": "montant",
  "y1": -8391.7,
  "z1": 9860.0,
  "y2": -7900.0,
  "z2": 11040.0,
  "N_kN": 92.8,
  "taux": 0.069
 },
 {
  "famille": "montant",
  "y1": -5891.7,
  "z1": 9860.0,
  "y2": -5400.0,
  "z2": 11040.0,
  "N_kN": 64.7,
  "taux": 0.048
 },
 {
  "famille": "montant",
  "y1": -3391.7,
  "z1": 9860.0,
  "y2": -2900.0,
  "z2": 11040.0,
  "N_kN": 36.6,
  "taux": 0.027
 },
 {
  "famille": "montant",
  "y1": -891.7,
  "z1": 9860.0,
  "y2": -400.0,
  "z2": 11040.0,
  "N_kN": 8.5,
  "taux": 0.006
 },
 {
  "famille": "montant",
  "y1": 1608.3,
  "z1": 9860.0,
  "y2": 2100.0,
  "z2": 11040.0,
  "N_kN": 0.0,
  "taux": 0.0
 },
 {
  "famille": "montant",
  "y1": 4108.3,
  "z1": 9860.0,
  "y2": 4600.0,
  "z2": 11040.0,
  "N_kN": 19.6,
  "taux": 0.014
 },
 {
  "famille": "montant",
  "y1": 6608.3,
  "z1": 9860.0,
  "y2": 7100.0,
  "z2": 11040.0,
  "N_kN": 47.7,
  "taux": 0.035
 },
 {
  "famille": "montant",
  "y1": 9108.3,
  "z1": 9860.0,
  "y2": 9600.0,
  "z2": 11040.0,
  "N_kN": 75.8,
  "taux": 0.056
 },
 {
  "famille": "montant",
  "y1": 11608.3,
  "z1": 9860.0,
  "y2": 12100.0,
  "z2": 11040.0,
  "N_kN": 103.9,
  "taux": 0.077
 },
 {
  "famille": "montant",
  "y1": 14108.3,
  "z1": 9860.0,
  "y2": 14600.0,
  "z2": 11040.0,
  "N_kN": 132.0,
  "taux": 0.098
 },
 {
  "famille": "montant",
  "y1": 16608.3,
  "z1": 9860.0,
  "y2": 17100.0,
  "z2": 11040.0,
  "N_kN": 160.1,
  "taux": 0.118
 },
 {
  "famille": "montant",
  "y1": 19108.3,
  "z1": 9860.0,
  "y2": 19600.0,
  "z2": 11040.0,
  "N_kN": -14.1,
  "taux": 0.008
 },
 {
  "famille": "diagonale",
  "y1": -15891.7,
  "z1": 9860.0,
  "y2": -12900.0,
  "z2": 11040.0,
  "N_kN": -445.7,
  "taux": 0.296
 },
 {
  "famille": "diagonale",
  "y1": -13391.7,
  "z1": 9860.0,
  "y2": -10400.0,
  "z2": 11040.0,
  "N_kN": -375.0,
  "taux": 0.249
 },
 {
  "famille": "diagonale",
  "y1": -10891.7,
  "z1": 9860.0,
  "y2": -7900.0,
  "z2": 11040.0,
  "N_kN": -304.3,
  "taux": 0.202
 },
 {
  "famille": "diagonale",
  "y1": -8391.7,
  "z1": 9860.0,
  "y2": -5400.0,
  "z2": 11040.0,
  "N_kN": -233.6,
  "taux": 0.155
 },
 {
  "famille": "diagonale",
  "y1": -5891.7,
  "z1": 9860.0,
  "y2": -2900.0,
  "z2": 11040.0,
  "N_kN": -162.9,
  "taux": 0.108
 },
 {
  "famille": "diagonale",
  "y1": -3391.7,
  "z1": 9860.0,
  "y2": -400.0,
  "z2": 11040.0,
  "N_kN": -92.2,
  "taux": 0.061
 },
 {
  "famille": "diagonale",
  "y1": -891.7,
  "z1": 9860.0,
  "y2": 2100.0,
  "z2": 11040.0,
  "N_kN": -21.4,
  "taux": 0.014
 },
 {
  "famille": "diagonale",
  "y1": 4108.3,
  "z1": 9860.0,
  "y2": 2100.0,
  "z2": 11040.0,
  "N_kN": -35.7,
  "taux": 0.022
 },
 {
  "famille": "diagonale",
  "y1": 6608.3,
  "z1": 9860.0,
  "y2": 4600.0,
  "z2": 11040.0,
  "N_kN": -86.9,
  "taux": 0.054
 },
 {
  "famille": "diagonale",
  "y1": 9108.3,
  "z1": 9860.0,
  "y2": 7100.0,
  "z2": 11040.0,
  "N_kN": -138.1,
  "taux": 0.085
 },
 {
  "famille": "diagonale",
  "y1": 11608.3,
  "z1": 9860.0,
  "y2": 9600.0,
  "z2": 11040.0,
  "N_kN": -189.3,
  "taux": 0.117
 },
 {
  "famille": "diagonale",
  "y1": 14108.3,
  "z1": 9860.0,
  "y2": 12100.0,
  "z2": 11040.0,
  "N_kN": -240.5,
  "taux": 0.148
 },
 {
  "famille": "diagonale",
  "y1": 16608.3,
  "z1": 9860.0,
  "y2": 14600.0,
  "z2": 11040.0,
  "N_kN": -291.8,
  "taux": 0.18
 },
 {
  "famille": "diagonale",
  "y1": 19108.3,
  "z1": 9860.0,
  "y2": 17100.0,
  "z2": 11040.0,
  "N_kN": -343.0,
  "taux": 0.212
 }
];

export const DATE_CALCUL = '2026-11-22';
