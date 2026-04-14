import streamlit as st
from openai import OpenAI

st.set_page_config(page_title="Test LLM Local", page_icon="🤖")

st.title("🔌 Testeur de Connexion LM Studio")

# Configuration de la barre latérale
st.sidebar.header("Paramètres de connexion")
ip = st.sidebar.text_input("Adresse IP", value="10.211.54.197")
port = st.sidebar.text_input("Port", value="1234")
model_name = st.sidebar.text_input("Nom du modèle", value="local-model")

# Initialisation du client OpenAI configuré pour le local
client = OpenAI(
    base_url=f"http://{ip}:{port}/v1",
    api_key="lm-studio" # Clé requise mais non vérifiée en local
)

st.info(f"Tentative de connexion à http://{ip}:{port}/v1")

# Interface de Chat
if "messages" not in st.session_state:
    st.session_state.messages = []

for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

if prompt := st.chat_input("Tapez un message pour tester..."):
    st.session_state.messages.append({"role": "user", "content": prompt})
    with st.chat_message("user"):
        st.markdown(prompt)

    with st.chat_message("assistant"):
        message_placeholder = st.empty()
        full_response = ""
        
        try:
            # Test de l'appel avec Streaming
            response = client.chat.completions.create(
                model=model_name,
                messages=[{"role": m["role"], "content": m["content"]} for m in st.session_state.messages],
                stream=True,
                temperature=0.7
            )
            
            for chunk in response:
                if chunk.choices[0].delta.content:
                    full_response += chunk.choices[0].delta.content
                    message_placeholder.markdown(full_response + "▌")
            
            message_placeholder.markdown(full_response)
            st.session_state.messages.append({"role": "assistant", "content": full_response})
            
        except Exception as e:
            st.error(f"❌ Erreur de connexion : {str(e)}")
            st.warning("Vérifiez que LM Studio est lancé et que le 'Server' est sur ON.")