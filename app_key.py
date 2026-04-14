import streamlit as st
import os
from openai import OpenAI
from dotenv import load_dotenv

# --- CHARGEMENT DES VARIABLES D'ENVIRONNEMENT ---
load_dotenv()
OPENROUTER_API_KEY="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"
API_KEY = OPENROUTER_API_KEY

# --- CONFIGURATION DE LA PAGE ---
st.set_page_config(page_title="SQL Gemini Expert", layout="wide", page_icon="💎")

# Vérification de la clé API au démarrage
if not API_KEY:
    st.error("⚠️ La clé OPENROUTER_API_KEY est introuvable dans le fichier .env")
    st.stop()

# --- INITIALISATION DU CLIENT OPENROUTER ---
client = OpenAI(
    base_url="https://openrouter.ai/api/v1",
    api_key=API_KEY,
)

# --- INITIALISATION DE L'HISTORIQUE ---
if "messages" not in st.session_state:
    st.session_state.messages = []

# --- SIDEBAR ---
st.sidebar.title("⚙️ Configuration")

# Sélection du modèle Gemini 2.0 (IDs à jour pour OpenRouter)
model_options = {
    "Gemini 2.0 Flash-Lite": "google/gemini-2.0-flash-lite-001",
    "Gemini 2.0 Flash": "google/gemini-2.0-flash-001",
}
selected_model = st.sidebar.selectbox("Choisir le modèle", list(model_options.keys()))
model_id = model_options[selected_model]

# Configuration SQL
dialect = st.sidebar.selectbox("Dialecte SQL", ["PostgreSQL", "MySQL", "SQLite", "SQL Server"])

st.sidebar.divider()
st.sidebar.subheader("🗄️ Schéma de la base")
schema_input = st.sidebar.text_area(
    "Colle ton DDL ou schéma ici :",
    height=300,
    placeholder="CREATE TABLE users (id INT, email TEXT...);"
)

if st.sidebar.button("🗑️ Effacer la discussion"):
    st.session_state.messages = []
    st.rerun()

# --- CONSTRUCTION DU PROMPT ---
def build_system_prompt(schema, dialect):
    return f"""
Tu es un expert mondial en ingénierie SQL spécialisé en {dialect}.
Ton objectif est de générer des requêtes SQL performantes, précises et lisibles.

### INSTRUCTIONS CRITIQUES :
1. **Utilise EXCLUSIVEMENT** les tables et colonnes définies dans le schéma fourni.
2. **Jointures :** Utilise des jointures explicites (INNER JOIN, LEFT JOIN).
3. **Complexité :** Utilise des CTE (WITH) pour la clarté.
4. **Dates :** Syntaxe spécifique à {dialect}.
5. **Sortie :** Donne la requête SQL dans un bloc de code, puis une brève explication.
6. **Sécurité :** Si le schéma ne permet pas de répondre, dis-le. Ne jamais inventer de données.

### SCHÉMA DE LA BASE DE DONNÉES :
{schema if schema else "Aucun schéma fourni."}
"""

# --- CHAT INTERFACE ---
st.title(f"💬 Chat avec {selected_model}")
st.info(f"Mode expert SQL activé pour {dialect}")

# Affichage des messages de l'historique
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# Entrée utilisateur
if prompt := st.chat_input("Ex: Calcule le taux de rétention mensuel..."):
    
    # Ajouter le message utilisateur à l'historique et l'afficher
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    # Réponse de l'assistant
    with st.chat_message("assistant"):
        response_placeholder = st.empty()
        full_response = ""
        
        # Préparation des messages (System + Historique)
        messages_to_send = [
            {"role": "system", "content": build_system_prompt(schema_input, dialect)}
        ] + [
            {"role": m["role"], "content": m["content"]} for m in st.session_state.messages
        ]
        
        try:
            # Appel OpenRouter avec Streaming
            response = client.chat.completions.create(
                model=model_id,
                messages=messages_to_send,
                stream=True,
                extra_headers={
                    "HTTP-Referer": "http://localhost:8501",
                    "X-Title": "SQL Assistant Streamlit",
                }
            )
            
            # --- BOUCLE DE STREAMING CORRIGÉE ---
            for chunk in response:
                # Vérification de sécurité pour éviter "Index out of range"
                if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
                    content = chunk.choices[0].delta.content
                    if content: # On n'ajoute que si le contenu n'est pas None
                        full_response += content
                        response_placeholder.markdown(full_response + "▌")
            
            # Affichage final sans le curseur
            response_placeholder.markdown(full_response)
            # Sauvegarde dans l'historique
            st.session_state.messages.append({"role": "assistant", "content": full_response})
            
        except Exception as e:
            st.error(f"Erreur API : {e}")