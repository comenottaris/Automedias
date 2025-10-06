#!/usr/bin/env python3
"""
Script de chargement des sites décrits dans le JSON vers une base Neon PostgreSQL.

Prérequis :
    pip install psycopg2-binary
"""

import json
import os
from pathlib import Path
import psycopg2
from psycopg2.extras import Json, execute_values

# ----------------------------------------------------------------------
# 1️⃣  Configuration – URL de connexion Neon
# ----------------------------------------------------------------------
NEON_URL = (
    "postgresql://neondb_owner:"
    "npg_4XfqJQhV3bpe@ep-dark-forest-abvkn94d-pooler."
    "eu-west-2.aws.neon.tech/neondb?"
    "sslmode=require&channel_binding=require"
)

# ----------------------------------------------------------------------
# 2️⃣  Lecture du JSON (soit depuis un fichier, soit depuis une variable)
# ----------------------------------------------------------------------
# Option A – charger depuis un fichier « db.json » placé dans le même répertoire
JSON_PATH = Path(__file__).with_name("db.json")
if JSON_PATH.is_file():
    with open(JSON_PATH, "r", encoding="utf-8") as f:
        sites_data = json.load(f)
else:
    [
  {"url":"https://automedias.org/en/","title":"Automedias","type":"site","language":"en-US","country":"France","platforms":[],"data_formats":["text"],"emails":[],"html_path":"harvest/html/automedias.org_Automedias___A_media_revolution.html","md_path":"harvest/md/automedias.org_Automedias___A_media_revolution.md","wayback_status":"200","notes":"no public social profiles found (needs verification)"},
  {"url":"https://paris-luttes.info/","title":"Paris Luttes Info","type":"site","language":"fr","country":"France","platforms":[{"name":"X (Twitter)","url":"https://x.com/paris_luttes"},{"name":"Facebook","url":"https://www.facebook.com/parisluttes/"}],"data_formats":["image","text","video"],"emails":["paris-luttes-infos@riseup.net"],"html_path":"harvest/html/paris-luttes.info_Paris-luttes.info_-_Site_coopÃ©ratif_d_infos_et_de_luttes_Paris_-_banlieue.html","md_path":"harvest/md/paris-luttes.info_Paris-luttes.info_-_Site_coopÃ©ratif_d_infos_et_de_luttes_Paris_-_banlieue.md","wayback_status":"200","notes":""},
  {"url":"https://burezonelibre.noblogs.org/","title":"Bure Zone Libre","type":"noblogs","language":"fr-FR","country":"France","platforms":[{"name":"Facebook","url":"https://www.facebook.com/burezonelibre/"}],"data_formats":["image","text"],"emails":[],"html_path":"harvest/html/burezonelibre.noblogs.org_Bure_Zone_Libre.html","md_path":"harvest/md/burezonelibre.noblogs.org_Bure_Zone_Libre.md","wayback_status":"ERR","notes":""},
  {"url":"https://zad.nadir.org/","title":"ZAD Nadir","type":"site","language":"fr","country":"France","platforms":[{"name":"X (Twitter)","url":"https://x.com/ZAD_NDDL"},{"name":"Facebook","url":"https://www.facebook.com/zadnddlinfo/"}],"data_formats":["audio","image","text"],"emails":[],"html_path":"harvest/html/zad.nadir.org_Zone_A_DÃ©fendre_-_Tritons_crÃ©tÃ©-e-s_contre_bÃ©ton_armÃ©.html","md_path":"harvest/md/zad.nadir.org_Zone_A_DÃ©fendre_-_Tritons_crÃ©tÃ©-e-s_contre_bÃ©ton_armÃ©.md","wayback_status":"ERR","notes":""},
  {"url":"https://midianinja.org/","title":"Mídia NINJA","type":"site","language":"pt-br","country":"Brazil","platforms":[{"name":"Facebook","url":"https://www.facebook.com/midianinja"},{"name":"Instagram","url":"https://www.instagram.com/midianinja/"},{"name":"Telegram","url":"https://t.me/midianinja"},{"name":"X (Twitter)","url":"https://x.com/midianinja"},{"name":"YouTube","url":"https://www.youtube.com/@midianinja"}],"data_formats":["image","text","video"],"emails":[],"html_path":"harvest/html/midianinja.org_MÃ­dia_NINJA.html","md_path":"harvest/md/midianinja.org_MÃ­dia_NINJA.md","wayback_status":"ERR","notes":""},
  {"url":"https://crimethinc.com/","title":"CrimethInc.","type":"site","language":"en","country":"USA","platforms":[{"name":"Facebook","url":"https://www.facebook.com/crimethinc"},{"name":"Instagram","url":"https://www.instagram.com/crimethinc/"},{"name":"YouTube","url":"https://www.youtube.com/@crimethinc"},{"name":"PeerTube (instance)","url":"https://crimethinc.p2p/"},{"name":"Telegram","url":"https://t.me/crimethinc"}],"data_formats":["text","video"],"emails":["help@crimethinc.com"],"html_path":"harvest/html/crimethinc.com_CrimethInc..html","md_path":"harvest/md/crimethinc.com_CrimethInc..md","wayback_status":"ERR","notes":""},
  {"url":"https://indymedia.org/","title":"Indymedia","type":"site","language":"","country":"International","platforms":[{"name":"Facebook","url":"https://www.facebook.com/indymedianetwork/"}],"data_formats":["text"],"emails":[],"html_path":"harvest/html/indymedia.org_Indymedia.org.html","md_path":"harvest/md/indymedia.org_Indymedia.org.md","wayback_status":"200","notes":""},
  {"url":"https://unframe.com/","title":"UnFrame","type":"site","language":"en-US","country":"International","platforms":[{"name":"Instagram","url":"https://www.instagram.com/unframe/"},{"name":"Twitter","url":"https://twitter.com/unframe"},{"name":"Facebook","url":"https://www.facebook.com/unframe"}],"data_formats":["image","text"],"emails":[],"html_path":"harvest/html/unframe.com_Frontpage_-_UnFrame.html","md_path":"harvest/md/unframe.com_Frontpage_-_UnFrame.md","wayback_status":"ERR","notes":""},
  {"url":"https://rojavainformationcenter.org/","title":"Rojava Information Center","type":"site","language":"en-GB","country":"Kurdistan","platforms":[{"name":"Facebook","url":"https://www.facebook.com/rojavainformationcenter"},{"name":"Instagram","url":"https://www.instagram.com/rojavainformationcenter/"},{"name":"X (Twitter)","url":"https://x.com/rojavainfo"}],"data_formats":["image","text"],"emails":["ric@rojavainformationcenter.org"],"html_path":"harvest/html/rojavainformationcenter.org_Rojava_Information_Center.html","md_path":"harvest/md/rojavainformationcenter.org_Rojava_Information_Center.md","wayback_status":"ERR","notes":""},
  {"url":"https://hawarnews.com/en","title":"Hawar News","type":"site","language":"","country":"Kurdistan","platforms":[],"data_formats":[],"emails":[],"html_path":"","md_path":"","wayback_status":"","notes":"no public social profiles found (needs verification)"},
  {"url":"https://www.solidaritycollectives.org/en/","title":"Solidarity Collectives","type":"site","language":"en-US","country":"Ukraine","platforms":[{"name":"Facebook","url":"https://www.facebook.com/solidaritycollectives"},{"name":"Instagram","url":"https://www.instagram.com/solidaritycollectives/"},{"name":"Telegram","url":"https://t.me/solidaritycollectives"},{"name":"X (Twitter)","url":"https://x.com/solidaritycolls"},{"name":"YouTube","url":"https://www.youtube.com/@solidaritycollectives"}],"data_formats":["image","text","video"],"emails":["solidaritycollectives@riseup.net"],"html_path":"harvest/html/www.solidaritycollectives.org_Solidarity_Collectives.html","md_path":"harvest/md/www.solidaritycollectives.org_Solidarity_Collectives.md","wayback_status":"ERR","notes":""},
  {"url":"https://mutualaid.nyc/","title":"Mutual Aid NYC","type":"other","language":"en-US","country":"USA","platforms":[{"name":"Facebook","url":"https://www.facebook.com/MutualAidNYC"},{"name":"Instagram","url":"https://www.instagram.com/MutualAidNYC/"}],"data_formats":["image","text"],"emails":[],"html_path":"harvest/html/mutualaid.nyc_Mutual_Aid_NYC___Mutual_Aid_Groups_and_Resources_for_New_York_City.html","md_path":"harvest/md/mutualaid.nyc_Mutual_Aid_NYC___Mutual_Aid_Groups_and_Resources_for_New_York_City.md","wayback_status":"200","notes":""},
  {"url":"https://www.inmediahk.net/","title":"InMedia HK","type":"site","language":"","country":"Hong Kong","platforms":[{"name":"Facebook","url":"https://www.facebook.com/inmediahk/"}],"data_formats":[],"emails":[],"html_path":"","md_path":"","wayback_status":"","notes":""},
  {"url":"https://autonomedia.org/","title":"Autonomedia","type":"site","language":"en-US","country":"USA","platforms":[{"name":"Facebook","url":"https://www.facebook.com/autonomediapress/"},{"name":"YouTube","url":"https://www.youtube.com/@AutonomediaPress"}],"data_formats":["image","text","video"],"emails":[],"html_path":"harvest/html/autonomedia.org_Autonomedia.html","md_path":"harvest/md/autonomedia.org_Autonomedia.md","wayback_status":"200","notes":""},
  {"url":"https://zadforever.blog/","title":"ZAD Forever","type":"other","language":"fr-FR","country":"International","platforms":[{"name":"Facebook","url":"https://www.facebook.com/ZadForever/"}],"data_formats":["image","text","video"],"emails":[],"html_path":"harvest/html/zadforever.blog_Zad_for_ever___Notre-Dame-des-Landes___Nouvelles_de_la_Zad.html","md_path":"harvest/md/zadforever.blog_Zad_for_ever___Notre-Dame-des-Landes___Nouvelles_de_la_Zad.md","wayback_status":"200","notes":"some profiles are local pages (needs verification)"},
  {"url":"https://t.me/s/rojavamedia","title":"Rojava Media (Telegram)","type":"telegram","language":"","country":"Kurdistan","platforms":[{"name":"Telegram","url":"https://t.me/s/rojavamedia"}],"data_formats":["image","text"],"emails":[],"html_path":"harvest/html/t.me_Telegram__View__rojavamedia.html","md_path":"harvest/md/t.me_Telegram__View__rojavamedia.md","wayback_status":"ERR","notes":""},
  {"url":"https://t.me/s/PADirectory","title":"PA Directory (Telegram)","type":"telegram","language":"","country":"USA","platforms":[{"name":"Telegram","url":"https://t.me/s/PADirectory"}],"data_formats":["image","text"],"emails":[],"html_path":"harvest/html/t.me_Pennsylvania_Directory___Telegram.html","md_path":"harvest/md/t.me_Pennsylvania_Directory___Telegram.md","wayback_status":"200","notes":""},
  {"url":"https://enlacezapatista.ezln.org.mx/","title":"Enlace Zapatista","type":"site","language":"es","country":"Mexico","platforms":[{"name":"Facebook","url":"https://www.facebook.com/EnlaceZapatista"},{"name":"Twitter","url":"https://x.com/enlacezapatista"},{"name":"YouTube","url":"https://www.youtube.com/@EnlaceZapatista"}],"data_formats":["image","text","video"],"emails":["laotra@ezln.org.mx","notienlacezap@gmail.com"],"html_path":"harvest/html/enlacezapatista.ezln.org.mx_Enlace_Zapatista.html","md_path":"harvest/md/enlacezapatista.ezln.org.mx_Enlace_Zapatista.md","wayback_status":"200","notes":""},
  {"url":"https://fnbbarcelona.org/","title":"FNB Barcelona","type":"site","language":"","country":"Spain","platforms":[{"name":"Facebook","url":"https://www.facebook.com/FNBbarcelona/"}],"data_formats":[],"emails":[],"html_path":"","md_path":"","wayback_status":"","notes":"local profiles (needs verification)"},
  {"url":"https://unicornriot.ninja/","title":"Unicorn Riot","type":"site","language":"","country":"USA","platforms":[{"name":"X (Twitter)","url":"https://x.com/unicornriot"},{"name":"YouTube","url":"https://www.youtube.com/unicornriot"},{"name":"Facebook","url":"https://www.facebook.com/unicornriot/"}],"data_formats":[],"emails":[],"html_path":"","md_path":"","wayback_status":"","notes":""},
  {"url":"https://parisabc.noblogs.org/","title":"Anarchist Black Cross Paris","type":"noblogs","language":"en-US","country":"France","platforms":[{"name":"noblogs","url":"https://parisabc.noblogs.org/"}],"data_formats":["image","text"],"emails":[],"html_path":"harvest/html/parisabc.noblogs.org_Anarchist_Black_Cross___PARIS___ILE-DE-FRANCE.html","md_path":"harvest/md/parisabc.noblogs.org_Anarchist_Black_Cross___PARIS___ILE-DE-FRANCE.md","wayback_status":"ERR","notes":""},
  {"url":"https://theanarchistlibrary.org/","title":"The Anarchist Library","type":"site","language":"en","country":"International","platforms":[{"name":"Facebook","url":"https://www.facebook.com/theanarchistlibrary/"}],"data_formats":["image","text"],"emails":[],"html_path":"harvest/html/theanarchistlibrary.org_The_Anarchist_Library___The_Anarchist_Library.html","md_path":"harvest/md/theanarchistlibrary.org_The_Anarchist_Library___The_Anarchist_Library.md","wayback_status":"200","notes":""},
  {"url":"https://anarchistlibraries.net/","title":"Anarchist Libraries","type":"site","language":"en","country":"International","platforms":[],"data_formats":[],"emails":[],"html_path":"harvest/html/anarchistlibraries.net_Mycorrhiza.html","md_path":"harvest/md/anarchistlibraries.net_Mycorrhiza.md","wayback_status":"200","notes":"no public social profiles found (needs verification)"},
  {"url":"https://mutualaid.wiki/","title":"Mutual Aid Wiki","type":"other","language":"en","country":"International","platforms":[],"data_formats":["text"],"emails":[],"html_path":"harvest/html/mutualaid.wiki_Mutual_Aid_Wiki.html","md_path":"harvest/md/mutualaid.wiki_Mutual_Aid_Wiki.md","wayback_status":"ERR","notes":"no public social profiles found (needs verification)"},
  {"url":"https://mutual-aid.co.uk/","title":"Mutual Aid UK","type":"other","language":"en","country":"United Kingdom","platforms":[{"name":"Facebook","url":"https://www.facebook.com/MutualAidUK/"},{"name":"X (Twitter)","url":"https://x.com/MutualAidUK"}],"data_formats":["image","text"],"emails":["N223813@70.btclick.com","info@hastingsheart.com","ryan@alumni.rehab4addiction.co.uk","romsey.covid@gmail.com","info@loveyourneighbours.org","wearehornsey@gmail.com","neighborhoodsharehub@gmail.com","rodboroughcommunity@gmail.com","downhamsolidarityfund@protonmail.com"],"html_path":"harvest/html/mutual-aid.co.uk_Mutual_Aid.html","md_path":"harvest/md/mutual-aid.co.uk_Mutual_Aid.md","wayback_status":"200","notes":""},
  {"url":"https://nicegram.app/hub/category/politics-social-causes","title":"Nicegram Politics & Social Causes","type":"other","language":"en","country":"International","platforms":[{"name":"Instagram","url":"https://www.instagram.com/nicegram.app/"},{"name":"Telegram","url":"https://t.me/nicegramapp"},{"name":"X (Twitter)","url":"https://twitter.com/nicegramapp"},{"name":"YouTube","url":"https://www.youtube.com/@nicegramapp"}],"data_formats":["image","text","video"],"emails":["nicegram@appvillis.com","investor.relations@appvillis.com","info@thevertus.app","you@example.org","ncooperation@trumpsempire.io","ads@nicegram.app"],"html_path":"harvest/html/nicegram.app_Top_Telegram_Channels___Groups_by_Categories_for_Politics.html","md_path":"harvest/md/nicegram.app_Top_Telegram_Channels___Groups_by_Categories_for_Politics.md","wayback_status":"200","notes":""}
]


# ----------------------------------------------------------------------
# 3️⃣  Connexion à la base Neon
# ----------------------------------------------------------------------
def get_connection():
    """Retourne une connexion psycopg2 à Neon."""
    conn = psycopg2.connect(NEON_URL)
    conn.autocommit = False   # on gère les commits explicitement
    return conn


# ----------------------------------------------------------------------
# 4️⃣  Création de la table (si elle n’existe pas déjà)
# ----------------------------------------------------------------------
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS sites (
    id              SERIAL PRIMARY KEY,
    url             TEXT      NOT NULL,
    title           TEXT,
    type            TEXT,
    language        TEXT,
    country         TEXT,
    platforms       JSONB,    -- tableau d'objets {name, url}
    data_formats    TEXT[],  -- tableau de chaînes
    emails          TEXT[],  -- tableau de chaînes
    html_path       TEXT,
    md_path         TEXT,
    wayback_status  TEXT,
    notes           TEXT
);
"""

# ----------------------------------------------------------------------
# 5️⃣  Fonction d’insertion massive
# ----------------------------------------------------------------------
INSERT_SQL = """
INSERT INTO sites (
    url, title, type, language, country,
    platforms, data_formats, emails,
    html_path, md_path, wayback_status, notes
) VALUES %s;
"""

def prepare_record(rec):
    """Prépare un tuple compatible avec INSERT_SQL."""
    return (
        rec.get("url"),
        rec.get("title"),
        rec.get("type"),
        rec.get("language"),
        rec.get("country"),
        Json(rec.get("platforms", [])),          # JSONB
        rec.get("data_formats", []),            # texte[]
        rec.get("emails", []),                  # texte[]
        rec.get("html_path"),
        rec.get("md_path"),
        rec.get("wayback_status"),
        rec.get("notes"),
    )

# ----------------------------------------------------------------------
# 6️⃣  Main – exécution du pipeline
# ----------------------------------------------------------------------
def main():
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            # 6a. Créer la table
            cur.execute(CREATE_TABLE_SQL)

            # 6b. Préparer les valeurs à insérer
            values = [prepare_record(r) for r in sites_data]

            # 6c. Insertion massive (plus efficace que des INSERT séparés)
            execute_values(cur, INSERT_SQL, values, page_size=500)

        # Commit uniquement si tout s’est bien passé
        conn.commit()
        print(f"✅ Insertion terminée : {len(values)} enregistrements ajoutés.")
    except Exception as e:
        conn.rollback()
        print("❌ Erreur pendant l’insertion :", e)
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()