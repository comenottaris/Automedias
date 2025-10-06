# Atlas des Automédias

Centralise et rend consultables les collectifs, automédias et archives avec filtres et recherche.  
Les données sont stockées dans une base **Neon PostgreSQL** et affichées via Netlify.

---

## Structure du projet

```
auto-medias/
├─ db.json             # Données locales fallback
├─ index.html          # Page principale
├─ style.css           # Styles
├─ script.js           # Front-end pour afficher les cartes
├─ push_to_neon.py     # Script Python pour injecter les données dans Neon
├─ netlify.toml        # Config Netlify
├─ package.json        # Dépendances éventuelles
```

---

## Prérequis

- Python 3.9+
- `psycopg2-binary` :
```bash
pip install psycopg2-binary
```
- Compte Neon avec base PostgreSQL
- Compte GitHub et Netlify pour déploiement

---

## Configuration Neon

1. Copier la connection string depuis Neon :
```
postgresql://<user>:<password>@<host>/<dbname>?sslmode=require&channel_binding=require
```

2. Coller dans `push_to_neon.py` :
```python
NEON_URL = "postgresql://neondb_owner:npg_4XfqJQhV3bpe@ep-dark-forest-abvkn94d-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
```

---

## Injection des données

```bash
python push_to_neon.py
```
- Crée la table `sites` si nécessaire
- Insère les sites avec `platforms`, `data_formats`, `emails` au format JSON/array

---

## Déploiement Netlify

1. Pousser tout le dépôt sur GitHub
2. Lier le dépôt sur Netlify
3. Config Netlify :
   - Build command : `echo 'no build'`
   - Publish directory : `.`
   - Functions directory : `netlify/functions` (si fonctions pour fetch depuis Neon)

---

## Front-end

- `script.js` charge les sites depuis :
```javascript
const API_ENDPOINT = "/.netlify/functions/get_sites";
```
- Fallback sur `db.json` si la fonction échoue
- Affichage cartes + filtres + modal avec détails
- Réseaux sociaux cliquables directement

---

## Ajouter un nouveau site

1. Ajouter l’entrée dans `db.json`
2. Lancer `push_to_neon.py` pour mettre à jour Neon
3. Redéployer sur Netlify si besoin

> 💡 Pour automatiser l’ajout, créer un formulaire qui poste vers une fonction Netlify ou endpoint Python/Node.js

---

## Notes importantes

- La table `sites` doit exister pour que le front récupère les données via Netlify
- Modifications Neon **ne se propagent pas automatiquement** si on utilise seulement `db.json`
- Toujours respecter le schéma pour `platforms`, `data_formats`, `emails`
- Vérifier que les URLs des plateformes sont valides pour éviter les erreurs côté front
