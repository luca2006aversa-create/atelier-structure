// En ligne (page publiée) ou sur le PC (serveur local lancer.cmd) ?
// En ligne : pas de serveur. Le dessin est gardé dans le navigateur, les images ajoutées aussi.
export const enLigne = !['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

// ---------- Petite base du navigateur pour les images ajoutées en ligne ----------
const BASE = 'atelier-structure-images';
function ouvrir() {
  return new Promise((ok, ko) => {
    const r = indexedDB.open(BASE, 1);
    r.onupgradeneeded = () => r.result.createObjectStore('images');
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error);
  });
}

export async function garderImage(nom, blob) {
  const db = await ouvrir();
  await new Promise((ok, ko) => {
    const t = db.transaction('images', 'readwrite');
    t.objectStore('images').put(blob, nom);
    t.oncomplete = ok;
    t.onerror = () => ko(t.error);
  });
  db.close();
}

// Toutes les images gardées : [[nom, blob], ...]
export async function lireImages() {
  try {
    const db = await ouvrir();
    const res = await new Promise((ok, ko) => {
      const t = db.transaction('images', 'readonly');
      const s = t.objectStore('images');
      const noms = s.getAllKeys();
      const blobs = s.getAll();
      t.oncomplete = () => ok(noms.result.map((n, i) => [String(n), blobs.result[i]]));
      t.onerror = () => ko(t.error);
    });
    db.close();
    return res;
  } catch {
    return [];
  }
}

// Fait télécharger un texte comme fichier.
export function telecharger(nom, texte, type = 'image/svg+xml') {
  const url = URL.createObjectURL(new Blob([texte], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = nom;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
