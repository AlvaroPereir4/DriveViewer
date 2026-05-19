import os
import re
import json
import secrets
import smtplib
import ssl
from email.message import EmailMessage
from datetime import datetime, timedelta
from functools import wraps
from flask import Flask, jsonify, render_template, request, session, redirect, url_for, flash
from flask_sqlalchemy import SQLAlchemy
from flask_wtf.csrf import CSRFProtect
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from werkzeug.middleware.proxy_fix import ProxyFix
from sqlalchemy import text
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from werkzeug.security import check_password_hash, generate_password_hash
from dotenv import load_dotenv
import requests

load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))

SERVICE_ACCOUNT_FILE = 'api_key.json'
SCOPES = ['https://www.googleapis.com/auth/drive.readonly']

app = Flask(__name__, template_folder='templates', static_folder='static')
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1)

app.secret_key = os.environ.get('SECRET_KEY')
if not app.secret_key:
    raise RuntimeError("SECRET_KEY não definida no ambiente.")
app.permanent_session_lifetime = timedelta(hours=24)

csrf = CSRFProtect(app)
limiter = Limiter(get_remote_address, app=app, default_limits=[])

db_url = os.environ.get('DATABASE_URL', 'sqlite:///users.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)
app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
db = SQLAlchemy(app)

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    referral_info = db.Column(db.String(255))
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    registration_ip = db.Column(db.String(50))
    last_password_reset = db.Column(db.DateTime)

class RegistrationLog(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    ip_address = db.Column(db.String(50), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

class Media(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    drive_id = db.Column(db.String(100), unique=True, nullable=False)
    title = db.Column(db.String(200), nullable=False)
    original_title = db.Column(db.String(200))
    overview = db.Column(db.Text)
    poster_path = db.Column(db.String(200))
    backdrop_path = db.Column(db.String(200))
    release_date = db.Column(db.String(20))
    vote_average = db.Column(db.Float)
    media_type = db.Column(db.String(20))
    genres = db.Column(db.String(200))
    letterboxd_slug = db.Column(db.String(200))
    tmdb_id = db.Column(db.Integer)
    runtime = db.Column(db.String(20))
    tagline = db.Column(db.String(400))
    status = db.Column(db.String(50))
    number_of_seasons = db.Column(db.Integer)
    director = db.Column(db.String(200))
    cast_list = db.Column(db.String(500))
    trailer_key = db.Column(db.String(100))
    production_companies = db.Column(db.String(300))
    production_countries = db.Column(db.String(200))
    spoken_languages = db.Column(db.String(200))
    budget = db.Column(db.BigInteger)
    revenue = db.Column(db.BigInteger)
    vote_count = db.Column(db.Integer)
    popularity = db.Column(db.Float)
    belongs_to_collection = db.Column(db.String(200))

GENRE_MAP = {
    28: "Ação", 12: "Aventura", 16: "Animação", 35: "Comédia", 80: "Crime",
    99: "Documentário", 18: "Drama", 10751: "Família", 14: "Fantasia",
    36: "História", 27: "Terror", 10402: "Música", 9648: "Mistério",
    10749: "Romance", 878: "Ficção Científica", 10770: "Cinema TV",
    53: "Thriller", 10752: "Guerra", 37: "Faroeste",
    10759: "Ação e Aventura", 10765: "Sci-Fi & Fantasy"
}

def get_drive_service():
    try:
        if os.path.exists(SERVICE_ACCOUNT_FILE):
            print(f"DEBUG: Usando arquivo local em: {os.path.abspath(SERVICE_ACCOUNT_FILE)}")
            creds = service_account.Credentials.from_service_account_file(
                SERVICE_ACCOUNT_FILE, scopes=SCOPES)
        else:
            env_creds = os.environ.get('api_key')
            if env_creds:
                creds_json = json.loads(env_creds)
                creds = service_account.Credentials.from_service_account_info(
                    creds_json, scopes=SCOPES)
                print("DEBUG: Usando Variáveis de Ambiente (Vercel/Sistema)")
            else:
                print("ERRO CRÍTICO: Arquivo 'api_key.json' não encontrado e variável de ambiente não definida.")
                return None

        service = build('drive', 'v3', credentials=creds)
        print("Serviço do Google Drive conectado com sucesso.")
        return service
    except Exception as e:
        print(f"ERRO ao conectar com o Google Drive: {e}")
    return None

def get_home_items():
    medias = Media.query.all()
    

    home_items = [
        {
            "id": m.drive_id,
            "title": m.title,
            "synopsis": m.overview,
            "type": "folder" if m.media_type == 'tv' else "video",
            "tag": 'series' if m.media_type == 'tv' else 'movie',
            "poster": f"https://image.tmdb.org/t/p/w500{m.poster_path}" if m.poster_path else None,
            "backdrop": f"https://image.tmdb.org/t/p/original{m.backdrop_path}" if m.backdrop_path else None,
            "rating": m.vote_average,
            "year": m.release_date[:4] if m.release_date else "",
            "release_date": m.release_date,
            "original_title": m.original_title,
            "genres": [g.strip() for g in m.genres.split(',')] if m.genres else [],
            "letterboxd_slug": m.letterboxd_slug,
            "runtime": m.runtime,
            "tagline": m.tagline,
            "status": m.status,
            "number_of_seasons": m.number_of_seasons,
            "director": m.director,
            "cast_list": m.cast_list,
            "trailer_key": m.trailer_key,
            "production_companies": m.production_companies,
            "production_countries": m.production_countries,
            "spoken_languages": m.spoken_languages,
            "budget": m.budget,
            "revenue": m.revenue,
            "vote_count": m.vote_count,
            "popularity": m.popularity,
            "belongs_to_collection": m.belongs_to_collection,
        } for m in medias
    ]
    return home_items

def get_drive_items(service, folder_id):
    if not service: return []
    try:
        try:
            current_folder = service.files().get(fileId=folder_id, fields="parents").execute()
            current_parents = current_folder.get('parents', [])
        except HttpError:
            current_parents = []

        query = f"'{folder_id}' in parents and trashed=false"
        fields = "files(id, name, mimeType, shortcutDetails, parents)"
        results = service.files().list(q=query, pageSize=200, fields=fields, supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
        files = results.get('files', [])
        for item in files:
            mime_type = item.get('mimeType')

            if mime_type == 'application/vnd.google-apps.shortcut':
                details = item.get('shortcutDetails', {})
                target_id = details.get('targetId')
                target_mime = details.get('targetMimeType')
                
                if target_id:
                    item['id'] = target_id
                
                if target_mime:
                    mime_type = target_mime
                    item['mimeType'] = target_mime

            if current_parents:
                item['parents'] = current_parents

            if mime_type and mime_type.startswith('video/'):
                item['type'] = 'video'
            else:
                item['type'] = 'folder'

        files.sort(key=lambda x: [int(c) if c.isdigit() else c.lower() for c in re.split(r'(\d+)', x.get('name', ''))])

        return files
    except HttpError as error:
        print(f"Ocorreu um erro ao buscar itens do Drive: {error}")
        return []

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return redirect(url_for('login'))
        
        user = User.query.filter_by(username=session['user']).first()
        admin_email = os.environ.get('ADMIN_EMAIL')
        
        if not user or not admin_email or user.email != admin_email:
            flash('Acesso negado. Área restrita para administradores.', 'error')
            return redirect(url_for('index'))
            
        return f(*args, **kwargs)
    return decorated_function

def get_app_version():
    try:
        with open('CHANGELOG.md', 'r', encoding='utf-8') as f:
            content = f.read()
            match = re.search(r'## \[(\d+\.\d+\.\d+)\]', content)
            if match:
                return match.group(1)
    except Exception:
        pass
    return '0.0.1'

@app.context_processor
def inject_globals():
    is_admin = False
    if 'user' in session:
        user = User.query.filter_by(username=session['user']).first()
        admin_email = os.environ.get('ADMIN_EMAIL')
        if user and admin_email and user.email == admin_email:
            is_admin = True
            
    return dict(version=get_app_version(), github_url="https://github.com/AlvaroPereir4/DriveViewer", is_admin=is_admin)

DRIVE_SERVICE = get_drive_service()

@app.route('/login', methods=['GET', 'POST'])
@limiter.limit("10 per minute", methods=["POST"])
def login():
    if request.method == 'POST':
        login_input = request.form.get('username')
        password = request.form.get('password')
        user = User.query.filter((User.username == login_input) | (User.email == login_input)).first()
        
        if user and check_password_hash(user.password_hash, password):
            session.permanent = True
            session['user'] = user.username
            return redirect(url_for('index'))
        else:
            flash('Usuário ou senha inválidos', 'error')
            
    return render_template('login.html')

@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        client_ip = request.remote_addr

        last_reg = RegistrationLog.query.filter_by(ip_address=client_ip).order_by(RegistrationLog.timestamp.desc()).first()
        
        if last_reg and (datetime.utcnow() - last_reg.timestamp) < timedelta(hours=24):
            flash('Limite de criação de contas atingido. Tente novamente em 24 horas.', 'error')
            return render_template('register.html')

        username = request.form.get('username')
        email = request.form.get('email')
        password = request.form.get('password')
        confirm_password = request.form.get('confirm_password')

        if password != confirm_password:
            flash('As senhas não coincidem.', 'error')
            return render_template('register.html')

        if User.query.filter_by(username=username).first():
            flash('Nome de usuário já existe.', 'error')
            return render_template('register.html')

        if User.query.filter_by(email=email).first():
            flash('Este e-mail já está cadastrado.', 'error')
            return render_template('register.html')

        referral_type = request.form.get('referral_type')
        referral_info = "Não informado"

        if referral_type == 'recommended':
            rec_by = request.form.get('recommended_by', '').strip()
            if not rec_by:
                flash('Por favor, informe quem recomendou o site.', 'error')
                return render_template('register.html')
            referral_info = f"Recomendado por: {rec_by}"
        elif referral_type == 'github':
            referral_info = "Pelo GitHub"
        elif referral_type == 'other':
            other_reason = request.form.get('other_reason', '').strip()
            if not other_reason:
                flash('Por favor, especifique como conheceu o site em "Outro".', 'error')
                return render_template('register.html')
            referral_info = f"Outro: {other_reason}"

        hashed_password = generate_password_hash(password)
        new_user = User(
            username=username, 
            email=email,
            password_hash=hashed_password, 
            referral_info=referral_info,
            registration_ip=client_ip
        )
        
        try:
            db.session.add(new_user)
            db.session.add(RegistrationLog(ip_address=client_ip))
            db.session.commit()
            flash('Conta criada com sucesso! Faça login.', 'success')
            return redirect(url_for('login'))
        except Exception as e:
            flash('Erro ao criar conta. Tente novamente.', 'error')
            print(e)

    return render_template('register.html')

@app.route('/forgot-password', methods=['GET', 'POST'])
@limiter.limit("5 per hour", methods=["POST"])
def forgot_password():
    if request.method == 'POST':
        email = request.form.get('email')
        user = User.query.filter_by(email=email).first()
        
        if user:
            token = secrets.token_urlsafe(8)
            user.password_hash = generate_password_hash(token)
            db.session.commit()
            
            email_sender = os.environ.get('EMAIL_USER')
            email_password = os.environ.get('EMAIL_PASS')

            if email_sender and email_password:
                try:
                    msg = EmailMessage()
                    msg.set_content(f"Olá,\n\nRecebemos um pedido de recuperação de conta.\n\nSua nova senha temporária é: {token}\n\nUse esta senha para fazer login e, em seguida, vá em 'Redefinir Senha' para escolher uma nova.\n\nSe não foi você, ignore este e-mail.")
                    msg['Subject'] = 'Recuperação de Senha - DriveViewer'
                    msg['From'] = email_sender
                    msg['To'] = email

                    context = ssl.create_default_context()
                    with smtplib.SMTP_SSL('smtp.gmail.com', 465, context=context) as smtp:
                        smtp.login(email_sender, email_password)
                        smtp.send_message(msg)
                    
                    flash('Uma nova senha temporária foi enviada para o seu e-mail.', 'success')
                except Exception as e:
                    print(f"Erro ao enviar email: {e}")
                    flash('Erro ao enviar o e-mail. Contate o administrador.', 'error')
            else:
                print(f"DEBUG TOKEN: {token}")
                flash('Sistema de e-mail não configurado. Contate o admin.', 'error')

            return redirect(url_for('login'))
        else:
            flash('Se o e-mail estiver cadastrado, você receberá as instruções.', 'info')
            
    return render_template('forgot_password.html')

@app.route('/reset-password', methods=['GET', 'POST'])
@login_required
def reset_password():
    user = User.query.filter_by(username=session['user']).first()
    
    if request.method == 'POST':
        if user.last_password_reset and (datetime.utcnow() - user.last_password_reset) < timedelta(hours=24):
            flash('Você só pode redefinir sua senha uma vez a cada 24 horas por segurança.', 'error')
            return render_template('reset_password.html')

        new_password = request.form.get('new_password')
        confirm_password = request.form.get('confirm_password')

        if new_password != confirm_password:
            flash('As senhas não coincidem.', 'error')
            return render_template('reset_password.html')

        user.password_hash = generate_password_hash(new_password)
        user.last_password_reset = datetime.utcnow()
        db.session.commit()
        flash('Sua senha foi atualizada com sucesso!', 'success')
        return redirect(url_for('index'))

    return render_template('reset_password.html')

@app.route('/settings')
@login_required
def settings():
    return render_template('settings.html')

@app.route('/admin')
@admin_required
def admin_dashboard():
    medias = Media.query.order_by(Media.id.desc()).all()
    return render_template('admin_dashboard.html', medias=medias)

@app.route('/admin/edit/<int:id>', methods=['GET', 'POST'])
@admin_required
def admin_edit(id):
    media = Media.query.get_or_404(id)
    if request.method == 'POST':
        media.title = request.form.get('title')
        media.original_title = request.form.get('original_title')
        media.drive_id = request.form.get('drive_id')
        media.overview = request.form.get('overview')
        media.poster_path = request.form.get('poster_path')
        media.backdrop_path = request.form.get('backdrop_path')
        media.release_date = request.form.get('release_date')
        media.media_type = request.form.get('media_type')
        media.genres = request.form.get('genres')
        media.letterboxd_slug = request.form.get('letterboxd_slug')
        media.tagline = request.form.get('tagline')
        media.status = request.form.get('status')
        media.runtime = request.form.get('runtime')
        media.director = request.form.get('director')
        media.cast_list = request.form.get('cast_list')
        media.trailer_key = request.form.get('trailer_key')
        media.production_companies = request.form.get('production_companies')
        media.production_countries = request.form.get('production_countries')
        media.spoken_languages = request.form.get('spoken_languages')
        media.belongs_to_collection = request.form.get('belongs_to_collection')
        try: media.vote_average = float(request.form.get('vote_average'))
        except (ValueError, TypeError): pass
        try: media.vote_count = int(request.form.get('vote_count'))
        except (ValueError, TypeError): pass
        try: media.popularity = float(request.form.get('popularity'))
        except (ValueError, TypeError): pass
        try: media.number_of_seasons = int(request.form.get('number_of_seasons'))
        except (ValueError, TypeError): pass
        try: media.tmdb_id = int(request.form.get('tmdb_id'))
        except (ValueError, TypeError): pass
        try: media.budget = int(request.form.get('budget'))
        except (ValueError, TypeError): pass
        try: media.revenue = int(request.form.get('revenue'))
        except (ValueError, TypeError): pass
        db.session.commit()
        flash('Mídia atualizada com sucesso!', 'success')
        return redirect(url_for('admin_dashboard'))
    return render_template('admin_edit.html', media=media)

@app.route('/api/admin/media/<int:id>', methods=['POST'])
@admin_required
def api_update_media(id):
    media = Media.query.get_or_404(id)
    data = request.get_json()
    if not data:
        return jsonify({'error': 'Dados inválidos'}), 400

    str_fields = ['title','original_title','drive_id','overview','poster_path','backdrop_path',
                  'release_date','media_type','genres','letterboxd_slug','tagline','status',
                  'runtime','director','cast_list','trailer_key','production_companies',
                  'production_countries','spoken_languages','belongs_to_collection']
    for f in str_fields:
        if f in data:
            setattr(media, f, data[f] or None)

    for f, cast in [('vote_average', float), ('popularity', float),
                    ('vote_count', int), ('number_of_seasons', int),
                    ('tmdb_id', int), ('budget', int), ('revenue', int)]:
        if f in data:
            try: setattr(media, f, cast(data[f]) if data[f] not in (None, '') else None)
            except (ValueError, TypeError): pass

    db.session.commit()
    return jsonify({'ok': True, 'title': media.title})

@app.route('/admin/delete/<int:id>', methods=['POST'])
@admin_required
def admin_delete(id):
    media = Media.query.get_or_404(id)
    db.session.delete(media)
    db.session.commit()
    flash('Mídia removida com sucesso!', 'success')
    return redirect(url_for('admin_dashboard'))

@app.route('/add-media', methods=['GET', 'POST'])
@admin_required
def add_media():
    if request.method == 'POST':
        action = request.form.get('action')
        if action == 'search':
            query = request.form.get('query')
            media_type = request.form.get('media_type')
            if not query:
                flash('Por favor, insira um termo de busca.', 'error')
                return render_template('add_media.html', search_results=[])

            TMDB_API_KEY = os.environ.get('TMDB_API_KEY')
            if not TMDB_API_KEY:
                flash('Chave de API do TMDB não configurada.', 'error')
                return render_template('add_media.html', search_results=[])

            search_url = f"https://api.themoviedb.org/3/search/{media_type}"
            params = {
                'api_key': TMDB_API_KEY,
                'query': query,
                'language': 'pt-BR'
            }
            try:
                response = requests.get(search_url, params=params)
                response.raise_for_status()
                data = response.json()
                results = []
                for item in data.get('results', []):
                    if media_type == 'movie':
                        title = item.get('title')
                        original_title = item.get('original_title')
                        release_date = item.get('release_date')
                    else: # tv
                        title = item.get('name')
                        original_title = item.get('original_name')
                        release_date = item.get('first_air_date')

                    results.append({
                        'id': item.get('id'),
                        'title': title,
                        'original_title': original_title,
                        'overview': item.get('overview'),
                        'poster_path': item.get('poster_path'),
                        'backdrop_path': item.get('backdrop_path'),
                        'release_date': release_date,
                        'vote_average': item.get('vote_average'),
                        'media_type': media_type,
                        'genre_ids': item.get('genre_ids', [])
                    })
                return render_template('add_media.html', search_results=results, query=query, media_type=media_type)
            except requests.exceptions.RequestException as e:
                flash(f'Erro ao buscar no TMDB: {e}', 'error')
                return render_template('add_media.html', search_results=[])
        
        elif action == 'add_to_db':
            drive_id = request.form.get('drive_id')
            tmdb_id = request.form.get('tmdb_id')
            media_type = request.form.get('media_type')

            if not drive_id or not tmdb_id or not media_type:
                flash('Dados incompletos para adicionar ao catálogo.', 'error')
                return redirect(url_for('add_media'))

            if Media.query.filter_by(drive_id=drive_id).first():
                flash('Este Drive ID já está no catálogo.', 'error')
                return redirect(url_for('add_media'))

            TMDB_API_KEY = os.environ.get('TMDB_API_KEY')
            if not TMDB_API_KEY:
                flash('Chave de API do TMDB não configurada.', 'error')
                return redirect(url_for('add_media'))

            details_url = f"https://api.themoviedb.org/3/{media_type}/{tmdb_id}"
            params = {
                'api_key': TMDB_API_KEY,
                'language': 'pt-BR'
            }
            try:
                response = requests.get(details_url, params=params)
                response.raise_for_status()
                item = response.json()

                genres_list = [GENRE_MAP.get(g['id'], g['name']) for g in item.get('genres', [])]
                genres_str = ", ".join(genres_list)

                if media_type == 'movie':
                    title = item.get('title')
                    original_title = item.get('original_title')
                    release_date = item.get('release_date')
                else: # tv
                    title = item.get('name')
                    original_title = item.get('original_name')
                    release_date = item.get('first_air_date')

                new_media = Media(
                    drive_id=drive_id,
                    title=title,
                    original_title=original_title,
                    overview=item.get('overview'),
                    poster_path=item.get('poster_path'),
                    backdrop_path=item.get('backdrop_path'),
                    release_date=release_date,
                    vote_average=item.get('vote_average'),
                    media_type=media_type,
                    genres=genres_str
                )
                db.session.add(new_media)
                db.session.commit()
                flash(f'"{title}" adicionado(a) ao catálogo com sucesso!', 'success')
                return redirect(url_for('add_media'))

            except requests.exceptions.RequestException as e:
                flash(f'Erro ao obter detalhes do TMDB: {e}', 'error')
                return redirect(url_for('add_media'))
            except Exception as e:
                flash(f'Erro ao salvar no banco de dados: {e}', 'error')
                db.session.rollback()
                return redirect(url_for('add_media'))

    return render_template('add_media.html', search_results=[])

@app.route('/logout')
def logout():
    session.pop('user', None)
    return redirect(url_for('login'))

@app.route('/')
@app.route('/category/<path:filter_tag>')
@app.route('/folder/<path:folder_id>')
@app.route('/watch/<path:item_id>')
@login_required
def index(filter_tag=None, folder_id=None, item_id=None):
    return render_template('index.html')

@app.route('/api/home')
@login_required
def home_content():
    items = get_home_items()
    return jsonify(items)

@app.route('/api/browse/<path:folder_id>')
@login_required
def browse_folder(folder_id):
    if not DRIVE_SERVICE:
        return jsonify({"error": "Serviço do Drive não está disponível."}), 500
    items = get_drive_items(DRIVE_SERVICE, folder_id)
    return jsonify(items)

def run_migrations():
    try:
        inspector = db.inspect(db.engine)
        if not inspector.has_table("media"):
            return

        columns = [col['name'] for col in inspector.get_columns('media')]
        new_columns = {
            'letterboxd_slug':      'VARCHAR(200)',
            'tmdb_id':              'INTEGER',
            'runtime':              'VARCHAR(20)',
            'tagline':              'VARCHAR(400)',
            'status':               'VARCHAR(50)',
            'number_of_seasons':    'INTEGER',
            'director':             'VARCHAR(200)',
            'cast_list':            'VARCHAR(500)',
            'trailer_key':          'VARCHAR(100)',
            'production_companies': 'VARCHAR(300)',
            'production_countries': 'VARCHAR(200)',
            'spoken_languages':     'VARCHAR(200)',
            'budget':               'BIGINT',
            'revenue':              'BIGINT',
            'vote_count':           'INTEGER',
            'popularity':           'FLOAT',
            'belongs_to_collection':'VARCHAR(200)',
        }
        with db.engine.connect() as conn:
            for col, col_type in new_columns.items():
                if col not in columns:
                    print(f"Migração: adicionando coluna '{col}'...")
                    conn.execute(text(f"ALTER TABLE media ADD COLUMN {col} {col_type}"))
            conn.commit()
    except Exception as e:
        print(f"Erro ao verificar/executar migrações: {e}")

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
        run_migrations()
    app.run(debug=True, port=5001)
