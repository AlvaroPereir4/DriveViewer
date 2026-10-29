"""
Scan resolution of all movies stored on Google Drive.

Reads every Media entry from the DB, queries the Drive API for
videoMediaMetadata (width × height) and prints a report grouped
by quality tier:  4K  ·  1080p  ·  720p  ·  SD  ·  Unknown

Usage:
    python scan_resolution.py            # all movies
    python scan_resolution.py --csv      # also save a CSV file
"""

import os
import sys
import json
import csv
import argparse
from datetime import datetime

from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy import create_engine, text

# ── Config ──────────────────────────────────────────────────────────
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SERVICE_ACCOUNT_FILE = os.path.join(os.path.dirname(__file__), 'api_key.json')
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

db_url = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)


def classify(height):
    """Return a human-friendly quality label from pixel height."""
    if height is None:
        return 'Desconhecido'
    if height >= 2160:
        return '4K'
    if height >= 1080:
        return '1080p'
    if height >= 720:
        return '720p'
    if height >= 480:
        return '480p'
    return 'SD'


def get_drive_service():
    if os.path.exists(SERVICE_ACCOUNT_FILE):
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES)
    else:
        env_creds = os.environ.get('api_key')
        if not env_creds:
            print('ERRO: api_key.json nao encontrado e env var nao definida.')
            sys.exit(1)
        creds = service_account.Credentials.from_service_account_info(
            json.loads(env_creds), scopes=SCOPES)
    return build('drive', 'v3', credentials=creds)


def fetch_video_resolution(service, file_id):
    """Query Drive API for videoMediaMetadata of a single file."""
    try:
        meta = service.files().get(
            fileId=file_id,
            fields='videoMediaMetadata,mimeType',
            supportsAllDrives=True,
        ).execute()

        vmm = meta.get('videoMediaMetadata')
        if vmm:
            return vmm.get('width'), vmm.get('height')

        # If it's a folder (series), skip
        return None, None
    except HttpError as e:
        if e.resp.status == 404:
            return 'NOT_FOUND', 'NOT_FOUND'
        print(f'  [ERRO] Drive API {e.resp.status} para {file_id}')
        return None, None
    except Exception as e:
        print(f'  [ERRO] {e}')
        return None, None


def main():
    parser = argparse.ArgumentParser(description='Scan movie resolutions from Google Drive')
    parser.add_argument('--csv', action='store_true', help='Export results to CSV')
    args = parser.parse_args()

    print('Conectando ao banco de dados...')
    engine = create_engine(db_url)

    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT drive_id, title, media_type FROM media ORDER BY title"
        )).fetchall()

    # Only scan movies (series are folders, not video files)
    movies = [(r[0], r[1]) for r in rows if r[2] != 'tv']
    series = [r for r in rows if r[2] == 'tv']

    print(f'Total de midias: {len(rows)}  |  Filmes: {len(movies)}  |  Series: {len(series)} (ignoradas)\n')

    service = get_drive_service()

    results = []
    for i, (drive_id, title) in enumerate(movies, 1):
        safe_title = title.encode('ascii', errors='replace').decode()
        print(f'[{i}/{len(movies)}] {safe_title}', end=' ... ')

        w, h = fetch_video_resolution(service, drive_id)

        if w == 'NOT_FOUND':
            tier = 'Nao encontrado'
            res_str = 'arquivo removido'
        elif w is not None and h is not None:
            tier = classify(h)
            res_str = f'{w}x{h}'
        else:
            tier = 'Desconhecido'
            res_str = 'sem metadata'

        results.append({
            'title': title,
            'drive_id': drive_id,
            'width': w if w != 'NOT_FOUND' else None,
            'height': h if h != 'NOT_FOUND' else None,
            'resolution': res_str,
            'tier': tier,
        })
        print(f'{res_str} -> {tier}')

    # ── Report ──────────────────────────────────────────────────────
    tiers_order = ['4K', '1080p', '720p', '480p', 'SD', 'Desconhecido', 'Nao encontrado']
    grouped = {}
    for r in results:
        grouped.setdefault(r['tier'], []).append(r)

    print('\n' + '=' * 60)
    print('  RELATORIO DE QUALIDADE')
    print('=' * 60)

    for tier in tiers_order:
        items = grouped.get(tier, [])
        if not items:
            continue
        print(f'\n--- {tier} ({len(items)} filmes) ---')
        for item in sorted(items, key=lambda x: x['title']):
            safe = item['title'].encode('ascii', errors='replace').decode()
            print(f'  {safe}  [{item["resolution"]}]')

    print(f'\n--- Resumo ---')
    for tier in tiers_order:
        count = len(grouped.get(tier, []))
        if count:
            bar = '#' * count
            print(f'  {tier:>16s}: {count:>3d}  {bar}')
    print(f'  {"TOTAL":>16s}: {len(results):>3d}')

    # ── CSV export ──────────────────────────────────────────────────
    if args.csv:
        ts = datetime.now().strftime('%Y%m%d_%H%M%S')
        csv_path = os.path.join(os.path.dirname(__file__), f'resolution_report_{ts}.csv')
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=['title', 'drive_id', 'width', 'height', 'resolution', 'tier'])
            writer.writeheader()
            writer.writerows(sorted(results, key=lambda x: x['title']))
        print(f'\nCSV salvo em: {csv_path}')


if __name__ == '__main__':
    main()
