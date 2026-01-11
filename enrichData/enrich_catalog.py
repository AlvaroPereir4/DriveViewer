import os
import json
import requests
import re
from app import app, db, Media, extract_id_from_link
from dotenv import load_dotenv

load_dotenv()
TMDB_API_KEY = os.environ.get('TMDB_API_KEY', '78ff393f56d5163de84e74f8a855daf6')
DATA_FILE = os.path.join('../data', 'links.json')

def search_tmdb(query, is_series=False):
    """Busca filme ou série no TMDB"""
    type_search = 'tv' if is_series else 'movie'
    url = f"https://api.themoviedb.org/3/search/{type_search}"
    params = {
        'api_key': TMDB_API_KEY,
        'query': query,
        'language': 'pt-BR'
    }
    res = requests.get(url, params=params)
    if res.status_code == 200:
        results = res.json().get('results', [])
        if results:
            return results[0]
    return None

def process_catalog():
    if not os.path.exists(DATA_FILE):
        print("Arquivo links.json não encontrado.")
        return

    with open(DATA_FILE, 'r', encoding='utf-8') as f:
        data = json.load(f)

    items_to_process = []
    if isinstance(data, list):
        items_to_process = data
    else:
        for key, val in data.items():
            items_to_process.extend(val)

    print(f"Iniciando enriquecimento de {len(items_to_process)} itens...")

    with app.app_context():
        db.create_all()

        for item in items_to_process:
            link = item.get('link')
            raw_title = item.get('title') or item.get('tittle')
            
            if not link or not raw_title:
                continue

            drive_id = extract_id_from_link(link)
            if not drive_id:
                continue

            if Media.query.filter_by(drive_id=drive_id).first():
                print(f"[SKIP] {raw_title} já está no banco.")
                continue

            is_series = 'folders/' in link
            media_type = 'tv' if is_series else 'movie'

            print(f"[API] Buscando dados para: {raw_title} ({media_type})...")
            
            tmdb_data = search_tmdb(raw_title, is_series)

            if tmdb_data:
                print(f"      -> Encontrado: {tmdb_data.get('title') or tmdb_data.get('name')}")
                
                new_media = Media(
                    drive_id=drive_id,
                    title=tmdb_data.get('title') or tmdb_data.get('name'),
                    original_title=tmdb_data.get('original_title') or tmdb_data.get('original_name'),
                    overview=tmdb_data.get('overview'),
                    poster_path=tmdb_data.get('poster_path'),
                    backdrop_path=tmdb_data.get('backdrop_path'),
                    release_date=tmdb_data.get('release_date') or tmdb_data.get('first_air_date'),
                    vote_average=tmdb_data.get('vote_average'),
                    media_type=media_type,
                    genres=str(tmdb_data.get('genre_ids'))
                )
                db.session.add(new_media)
                db.session.commit()
            else:
                print(f"      -> NÃO ENCONTRADO NO TMDB. Salvando básico.")
                fallback_media = Media(
                    drive_id=drive_id,
                    title=raw_title,
                    media_type=media_type,
                    overview="Sinopse indisponível."
                )
                db.session.add(fallback_media)
                db.session.commit()

if __name__ == "__main__":
    process_catalog()