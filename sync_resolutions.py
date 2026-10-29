import os
import sys
import time
import threading
from concurrent.futures import ThreadPoolExecutor

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from sqlalchemy import create_engine, text

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SERVICE_ACCOUNT_FILE = os.path.join(os.path.dirname(__file__), 'api_key.json')
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

db_url = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)


def classify_quality(width, height):
    """
    Classifica resolução em tier de qualidade de acordo com os padrões de cinema:
    Reconhece aspect ratios widescreen (2.35:1 / 2.40:1 / 1.85:1) e 4:3 com faixas pretas recortadas.
    """
    if not width or not height:
        return None
    # 4K UHD
    if width >= 3800 or height >= 2100:
        return '4K'
    # 1080p Full HD (1920x800+ ou 4:3 1440x1080)
    if width >= 1900 or height >= 1050 or (width >= 1400 and height >= 1000):
        return '1080p'
    # 720p HD (1280x528+ ou 4:3 960x720)
    if width >= 1200 or height >= 700 or (width >= 950 and height >= 700):
        return '720p'
    # 480p ED / DVD (720x480, 848x480, 640x480)
    if width >= 700 or height >= 480 or (width >= 640 and height >= 460):
        return '480p'
    # SD
    return 'SD'


thread_local = threading.local()

def get_thread_drive_service():
    if not hasattr(thread_local, 'service'):
        if os.path.exists(SERVICE_ACCOUNT_FILE):
            creds = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        else:
            import json
            env_creds = os.environ.get('api_key')
            if not env_creds:
                print('ERRO: api_key.json não encontrado.')
                sys.exit(1)
            creds = service_account.Credentials.from_service_account_info(
                json.loads(env_creds), scopes=SCOPES)
        thread_local.service = build('drive', 'v3', credentials=creds)
    return thread_local.service


def main():
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')

    print("Conectando ao banco de dados Supabase...")
    engine = create_engine(db_url)

    with engine.connect() as conn:
        movies = conn.execute(text(
            "SELECT drive_id, title FROM media WHERE media_type != 'tv' ORDER BY title"
        )).fetchall()

    print(f"Total de filmes a verificar: {len(movies)}")

    def process_movie(row):
        drive_id, title = row[0], row[1]
        try:
            svc = get_thread_drive_service()
            meta = svc.files().get(
                fileId=drive_id,
                fields='videoMediaMetadata',
                supportsAllDrives=True
            ).execute()
            vmm = meta.get('videoMediaMetadata')
            if vmm and vmm.get('width') and vmm.get('height'):
                w, h = vmm['width'], vmm['height']
                quality = classify_quality(w, h)
                res_str = f"{w}x{h}"
                return drive_id, title, quality, res_str, 'ok'
            return drive_id, title, None, None, 'no_vmm'
        except HttpError as e:
            if e.resp.status == 404:
                return drive_id, title, None, None, 'not_found'
            return drive_id, title, None, None, f'error_{e.resp.status}'
        except Exception as e:
            return drive_id, title, None, None, f'error_{type(e).__name__}'

    start_time = time.time()
    print("Buscando metadados no Google Drive (thread-safe, 4 workers)...")
    results = []
    with ThreadPoolExecutor(max_workers=4) as executor:
        for idx, res in enumerate(executor.map(process_movie, movies), 1):
            results.append(res)
            if idx % 25 == 0 or idx == len(movies):
                print(f"Progresso: {idx}/{len(movies)} filmes verificados...")

    elapsed = time.time() - start_time
    print(f"Varredura concluída em {elapsed:.1f} segundos!")

    # Atualizando o banco de dados
    print("Atualizando colunas 'quality' e 'resolution' no banco de dados...")
    updated_count = 0
    with engine.connect() as conn:
        for drive_id, title, quality, res_str, status in results:
            if quality:
                conn.execute(
                    text("UPDATE media SET quality = :q, resolution = :r WHERE drive_id = :id"),
                    {"q": quality, "r": res_str, "id": drive_id}
                )
                updated_count += 1
        conn.commit()

    print(f"\nSucesso! {updated_count} filmes atualizados com qualidade no banco.")

    # Resumo
    summary = {}
    for _, _, quality, _, status in results:
        key = quality if quality else f"Sem qualidade ({status})"
        summary[key] = summary.get(key, 0) + 1

    print("\n" + "=" * 45)
    print("  RESUMO DE QUALIDADES NO BANCO")
    print("=" * 45)
    for k, v in sorted(summary.items(), key=lambda x: -x[1]):
        print(f"  {k:<28}: {v:>3}")
    print("=" * 45)


if __name__ == '__main__':
    main()
