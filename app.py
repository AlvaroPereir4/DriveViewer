import os
import re
from flask import Flask, jsonify, render_template

# --- IMPORTAÇÕES DA API DO GOOGLE ---
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

# O arquivo de credenciais da Conta de Serviço
SERVICE_ACCOUNT_FILE = 'api_key.json'
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

app = Flask(__name__, template_folder='templates', static_folder='static')

def get_drive_service():
    """Cria um objeto de serviço do Drive usando uma Conta de Serviço."""
    try:
        creds = service_account.Credentials.from_service_account_file(
            SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        service = build('drive', 'v3', credentials=creds)
        print("Serviço do Google Drive conectado com sucesso usando Conta de Serviço.")
        return service
    except FileNotFoundError:
        print(f"ERRO: Arquivo de Conta de Serviço '{SERVICE_ACCOUNT_FILE}' não encontrado.")
    except Exception as e:
        print(f"Ocorreu um erro ao conectar com o Google Drive: {e}")
    return None

def get_root_folder_id():
    """Lê data/links.txt e extrai o ID da pasta raiz do Google Drive."""
    try:
        with open(os.path.join('data', 'links.txt'), 'r') as f:
            link = f.readline().strip()
            match = re.search(r'(?:folders/|id=)([a-zA-Z0-9_-]+)', link)
            if match:
                return match.group(1)
    except FileNotFoundError:
        print("AVISO: Arquivo 'data/links.txt' não encontrado.")
    return None

def get_drive_items(service, folder_id):
    """Busca arquivos e pastas de uma pasta do Google Drive."""
    if not service:
        return []
    try:
        query = f"'{folder_id}' in parents and trashed=false"
        fields = "files(id, name, mimeType)"
        results = service.files().list(
            q=query,
            pageSize=200,
            fields=fields,
            supportsAllDrives=True, # Necessário para Contas de Serviço
            includeItemsFromAllDrives=True
        ).execute()
        items = results.get('files', [])
        return items
    except HttpError as error:
        print(f"Ocorreu um erro ao buscar itens do Drive: {error}")
        return []

# --- Rotas da Aplicação ---

DRIVE_SERVICE = get_drive_service()
ROOT_FOLDER_ID = get_root_folder_id()

@app.route('/')
def index():
    """Serve a página principal da aplicação."""
    if not ROOT_FOLDER_ID:
        return "Erro: Pasta raiz do Google Drive não foi encontrada ou configurada em 'data/links.txt'.", 500
    if not DRIVE_SERVICE:
        return "Erro: Não foi possível conectar à API do Google Drive. Verifique o arquivo de credenciais e o console do servidor.", 500
    return render_template('index.html', root_folder_id=ROOT_FOLDER_ID)

@app.route('/api/browse/<path:folder_id>')
def browse_folder(folder_id):
    """Endpoint da API que lista o conteúdo de uma pasta do Drive."""
    items = get_drive_items(DRIVE_SERVICE, folder_id)
    return jsonify(items)

if __name__ == '__main__':
    app.run(debug=True, port=5001)