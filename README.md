# Automédiathèque — README

**But du projet**  
Base de données centralisée des collectifs / automédias (petites luttes, collectifs locaux, automédias). Interface filtrable et consultable, donnée source stockée dans **Neon (Postgres)** et servie via **Netlify Functions**.

---

## Structure du dépôt (racine)
```
/
├─ index.html                # interface front (cartes, filtres, modal)
├─ style.css                 # styles (mode Obsidian/dark)
├─ script.js                 # front-end : fetch API -> affichage cartes
├─ db.json                   # fallback local (dev)
├─ netlify.toml              # config Netlify (publish + functions)
├─ package.json              # si besoin (node deps)
└─ netlify/
   └─ functions/
      ├─ get_sites.js        # Netlify Function : GET => read ; POST => upsert
      └─ seed_sites.js       # Netlify Function : seed initial (optionnel)
```

---

## Organisation des données (schéma Postgres / Neon)
La base stocke les entrées `sites` (ou table nommée personnalisée). Schéma recommandé :

- `id` : SERIAL PRIMARY KEY  
- `url` : TEXT NOT NULL (clé logique)  
- `title` : TEXT  
- `type` : TEXT (`site` | `blog` | `telegram` | `noblogs` | `other`, etc.)  
- `language` : TEXT (code langue)  
- `country` : TEXT  
- `platforms` : JSONB (array d’objets `{name, url}`)  
- `data_formats` : TEXT[] (`text`, `image`, `video`, `audio`, etc.)  
- `emails` : TEXT[]  
- `html_path` / `md_path` : TEXT (liens vers copies locales)  
- `wayback_status` : TEXT  
- `notes` : TEXT

> Recommandation : imposer **UNIQUE(url)** pour pouvoir upserter proprement (`ON CONFLICT (url)`).

---

## Configuration Neon (procédure sans divulguer de secret)
1. Créer un projet / base dans Neon.  
2. Noter : *connection string Postgres* (format `postgresql://user:pass@host/dbname?...`) — **NE PAS** committer cette valeur.  
3. (Optionnel) Activer l’API REST (PostgREST / Neon REST) et générer une **API key** (JWT/service key) si vous préférez requêter via REST.  
4. Depuis l’interface Neon (SQL editor) : créer la table si elle n’existe pas (ou laisser `get_sites` la créer).

**SQL utile (exécuter dans Neon SQL editor)** :
```sql
CREATE TABLE IF NOT EXISTS public.sites (
  id SERIAL PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  type TEXT,
  language TEXT,
  country TEXT,
  platforms JSONB,
  data_formats TEXT[],
  emails TEXT[],
  html_path TEXT,
  md_path TEXT,
  wayback_status TEXT,
  notes TEXT
);

ALTER TABLE public.sites
  ADD CONSTRAINT IF NOT EXISTS sites_url_unique UNIQUE (url);
```

---

## Netlify — déploiement et variables d’environnement
1. Sur Netlify, connecter le dépôt GitHub (branche `main` ou celle choisie).  
2. `netlify.toml` de base :
```toml
[build]
  command = "echo 'no build'"
  publish = "."
  functions = "netlify/functions"
```
3. Définir les variables d’environnement (Netlify → Site settings → Build & deploy → Environment):
- `PG_CONNECTION` ou `DATABASE_URL` = *chaine Postgres complète* (ex : `postgresql://...neon.tech/neondb?sslmode=require`)  
- (optionnel) `NEON_REST_URL` = *url du REST endpoint*  
- (optionnel) `NEON_REST_KEY` = *clé REST (JWT/service key)*  
- (optionnel) `TABLE_SCHEMA` = `public`  
- (optionnel) `TABLE_NAME` = `sites` (ou `Automedias` si table nommée autrement)

> **Important** : ne jamais committer ces valeurs dans le dépôt.

---

## Netlify Functions incluses (usage)
### `get_sites.js` (GET / POST)
- **GET** `/ .netlify/functions/get_sites`  
  - Renvoie une liste JSON des enregistrements : `SELECT * FROM schema."TableName" LIMIT N`.
- **POST** `/ .netlify/functions/get_sites`  
  - Permet d’**upserter** (INSERT ou UPDATE) un seul objet ou un tableau d’objets JSON.  
  - Body : `application/json` avec objet(s) respectant le schéma (doit inclure `url`).
- La function crée la table et la contrainte UNIQUE si nécessaire (utile pour premiers déploiements).

**Exemples** :

Lister (GET via curl) :
```bash
curl -s "https://TON_SITE.netlify.app/.netlify/functions/get_sites"
```

Upsert (POST) d’un objet :
```bash
curl -X POST "https://TON_SITE.netlify.app/.netlify/functions/get_sites" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://nouveau.example",
    "title":"Nouveau",
    "type":"site",
    "country":"France",
    "language":"fr",
    "platforms":[{"name":"X","url":"https://x.com/nouveau"}],
    "data_formats":["text","image"]
  }'
```

Upsert d’un tableau :
```bash
curl -X POST "https://TON_SITE.netlify.app/.netlify/functions/get_sites" \
 -H "Content-Type: application/json" \
 -d '[ {...}, {...} ]'
```

### `seed_sites.js` (optionnel)
- Fonction utilitaire pour insérer en masse les entrées initiales depuis un tableau codé (ou via REST).  
- **Utiliser une seule fois** pour peupler la table initiale, puis retirer / protéger la route.

---

## Front-end (`script.js`)
- Le front tente d’abord d’appeler la fonction Netlify (endpoint ci-dessus).  
- Si la fonction échoue (timeout, erreur), `db.json` est utilisé comme fallback local.  
- Affichage : cartes triables / filtrables ; clic ouvre une fenêtre modale interne avec détails (réseaux cliquables ouvrant de nouveaux onglets).

---

## Flux d’ajout / maintenance (workflow recommandé)
1. **Ajouter localement** une nouvelle entrée au format JSON (si dev) ou utiliser le front pour poster via `POST /get_sites`.  
2. **Upsert** : le `POST` vers `get_sites` insère ou met à jour l’enregistrement (clé logique = `url`).  
3. **Vérifier** via GET que l’entrée est présente.  
4. **Backups** : exporter périodiquement la table (Neon permet export SQL / dump) et/ou conserver copies `harvest/html` / `harvest/md` dans le repo privé.

---

## Sauvegardes et archivage
- Conserver copies locales de pages importantes (HTML/MD) dans `harvest/html` et `harvest/md`.  
- Utiliser Wayback / Odysee / mirror pour vidéos lourdes.  
- Export régulier de la table Postgres (dump) recommandé.

---

## Sécurité & bonnes pratiques
- **Jamais** committer de clés/credentials dans le dépôt public. Utiliser Netlify env vars.  
- Restreindre qui peut appeler les endpoints d’écriture (auth simple, token, ou Netlify Identity).  
- Protéger `seed_sites` ou limiter son usage (par token ou suppression après seed).  
- Pour production, externaliser les migrations et la création de schéma via script de migration (Flyway, sqitch, ou script Python séparé).

---

## Dépannage (erreurs fréquentes)
- **`relation "sites" does not exist`** → créer la table ou laisser la function créer la table automatiquement.  
- **`ON CONFLICT` error (no unique constraint)** → ajouter `UNIQUE(url)` sur la colonne `url`.  
- **Function retourne fallback** → vérifier logs Netlify, variables d’environnement et que la function est déployée (`netlify/functions/get_sites.js` présent dans le déploy).  
- **CORS / fetch failing** → vérifier que l’endpoint Netlify est correct et que le front utilise `/.netlify/functions/get_sites`.

---

## Exemple rapide — initialiser la base (procédure)
1. Déployer le code avec `get_sites.js` et `seed_sites.js`.  
2. Appeler (une seule fois) `seed_sites` (protéger par token si nécessaire) pour insérer les données initiales.  
3. Vérifier via `GET /.netlify/functions/get_sites`.  
4. Mettre à jour `db.json` si tu veux garder une copie locale de référence.

---

## Licence & crédits
- Projet libre : ajouter ici la licence souhaitée (MIT / CC-BY etc.).  
- Inspiré par les pratiques d’automedia et l’archivage communautaire.
