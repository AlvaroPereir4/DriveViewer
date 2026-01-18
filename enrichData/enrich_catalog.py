import os
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))
TMDB_API_KEY = os.environ.get('TMDB_API_KEY')

def search_tmdb(query, is_series=False):
    type_search = 'tv' if is_series else 'movie'
    url = f"https://api.themoviedb.org/3/search/{type_search}"
    params = {
        'api_key': TMDB_API_KEY,
        'query': query,
        'language': 'pt-BR'
    }
    try:
        res = requests.get(url, params=params)
        if res.status_code == 200:
            results = res.json().get('results', [])
            if results:
                return results
    except Exception as e:
        print(f"Erro na requisição: {e}")
    return None

def manual_lookup():
    print("\n=== FERRAMENTA DE BUSCA MANUAL (TMDB) ===")
    print("Digite o nome para buscar os metadados (sem salvar no banco).")

    while True:
        print("\n" + "="*50)
        query = input("Nome do Filme/Série (ou ENTER para sair): ").strip()
        
        if not query:
            print("Saindo...")
            break

        type_input = input("É uma série? (s/n) [Enter = Não]: ").strip().lower()
        is_series = type_input.startswith('s')
        media_type = 'tv' if is_series else 'movie'

        print(f"\n🔎 Buscando por: '{query}' ({media_type})...")
        
        results = search_tmdb(query, is_series)

        if results:
            print(f"\n✅ Encontrados {len(results)} resultados:\n")
            for i, item in enumerate(results):
                t = item.get('title') or item.get('name')
                d = item.get('release_date') or item.get('first_air_date')
                y = d[:4] if d else "????"
                o = item.get('original_title') or item.get('original_name')
                print(f"[{i+1}] {t} ({y}) - Original: {o}")
            
            try:
                sel = int(input("\nDigite o número do item correto (0 para cancelar): "))
                if sel <= 0 or sel > len(results):
                    print("Seleção cancelada.")
                    continue
                
                data = results[sel-1]
                print("\nDADOS SELECIONADOS! Copie abaixo:\n")
            except ValueError:
                print("Opção inválida. Digite apenas números.")
                continue
            
            # Preparando dados
            title = data.get('title') or data.get('name')
            original_title = data.get('original_title') or data.get('original_name')
            overview = data.get('overview')
            poster_path = data.get('poster_path')
            backdrop_path = data.get('backdrop_path')
            release_date = data.get('release_date') or data.get('first_air_date')
            vote_average = data.get('vote_average')
            
            genres = str(data.get('genre_ids'))

            print(f"title:          {title}")
            print(f"original_title: {original_title}")
            print(f"overview:       {overview}")
            print(f"poster_path:    {poster_path}")
            print(f"backdrop_path:  {backdrop_path}")
            print(f"release_date:   {release_date}")
            print(f"vote_average:   {vote_average}")
            print(f"media_type:     {media_type}")
            print(f"genres:         {genres}")
        else:
            print("\nNão encontrado no TMDB.")

if __name__ == "__main__":
    if not TMDB_API_KEY:
        print("ERRO: TMDB_API_KEY não encontrada. Verifique seu .env")
    else:
        manual_lookup()
