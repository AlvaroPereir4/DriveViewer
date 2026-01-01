import os
import re
import json
from flask import Flask, jsonify, render_template
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

SERVICE_ACCOUNT_FILE = 'api_key.json'
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
DATA_FILE = os.path.join('data', 'links.json')

app = Flask(__name__, template_folder='templates', static_folder='static')

def get_drive_service():
    try:
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        service = build('drive', 'v3', credentials=creds)
        print("Serviço do Google Drive conectado com sucesso.")
        return service
    except Exception as e:
        print(f"ERRO ao conectar com o Google Drive: {e}")
    return None

def extract_id_from_link(link):
    if not link: return None
    match = re.search(r'(?:folders/|file/d/|id=)([a-zA-Z0-9_-]{28,})', link)
    if match:
        return match.group(1)
    return None

def get_home_items():
    home_items = []
    try:
        with open(DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)

        for item_type, item_list in data.items():
            for item in item_list:
                drive_id = extract_id_from_link(item.get('link'))
                title = item.get('tittle', 'Título Desconhecido')
                if drive_id:
                    home_items.append({
                        "id": drive_id,
                        "title": title,
                        "synopsis": item.get('sinopse', 'Sem sinopse disponível.'),
                        "type": "folder" if item_type == "drive_folders" else "video",
                        "tag": item.get('tag', 'outros')
                    })
                else:
                    print(f"AVISO: Não foi possível extrair um ID de Drive válido do link para '{title}'. Link: {item.get('link')}")

    except FileNotFoundError:
        print(f"ERRO: Arquivo de dados '{DATA_FILE}' não encontrado.")
    except json.JSONDecodeError:
        print(f"ERRO: O arquivo '{DATA_FILE}' não é um JSON válido.")
    
    return home_items

def get_drive_items(service, folder_id):
    if not service: return []
    try:
        query = f"'{folder_id}' in parents and trashed=false"
        fields = "files(id, name, mimeType)"
        results = service.files().list(q=query, pageSize=200, fields=fields, supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
        return results.get('files', [])
    except HttpError as error:
        print(f"Ocorreu um erro ao buscar itens do Drive: {error}")
        return []

# --- Endpoints da API e Rotas ---

DRIVE_SERVICE = get_drive_service()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/home')
def home_content():
    items = get_home_items()
    return jsonify(items)

@app.route('/api/browse/<path:folder_id>')
def browse_folder(folder_id):
    if not DRIVE_SERVICE:
        return jsonify({"error": "Serviço do Drive não está disponível."}), 500
    items = get_drive_items(DRIVE_SERVICE, folder_id)
    return jsonify(items)

if __name__ == '__main__':
    app.run(debug=True, port=5001)