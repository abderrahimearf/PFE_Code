import streamlit as st
import os
import json
from dotenv import load_dotenv
from neo4j import GraphDatabase

# Utilisation UNIQUEMENT de langchain_openai (pas de conflits)
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import JsonOutputParser
from langchain_core.output_parsers import StrOutputParser

# ---------------------------------------------------------
# 1. CONFIGURATION & INITIALISATION
# ---------------------------------------------------------
load_dotenv()

# Connexion Neo4j
NEO4J_URI = os.getenv("NEO4J_URI", "neo4j://127.0.0.1:7687")
NEO4J_USERNAME = os.getenv("NEO4J_USERNAME", "neo4j")
NEO4J_PASSWORD = os.getenv("NEO4J_PASSWORD", "adminadmin")

# Connexion OpenRouter
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")

if not OPENROUTER_API_KEY or not OPENROUTER_API_KEY.startswith("sk-or"):
    st.error("🚨 ERREUR : Clé OPENROUTER_API_KEY introuvable ou mal formatée dans le fichier .env")
    st.stop()

# Initialisation de Gemini 2.5 Flash Lite VIA OPENROUTER
llm = ChatOpenAI(
    openai_api_key=OPENROUTER_API_KEY,
    openai_api_base="https://openrouter.ai/api/v1",
    model_name="google/gemini-2.5-flash-lite", 
    temperature=0
)

# Fonction pour se connecter à Neo4j
@st.cache_resource
def get_neo4j_driver():
    return GraphDatabase.driver(NEO4J_URI, auth=(NEO4J_USERNAME, NEO4J_PASSWORD))

driver = get_neo4j_driver()

# ---------------------------------------------------------
# 2. FONCTIONS DE TRAITEMENT (GRAPHE ET IA)
# ---------------------------------------------------------

def get_all_tables(driver):
    """Récupère la liste de toutes les tables disponibles."""
    query = "MATCH (t:Table) RETURN t.name as name"
    with driver.session() as session:
        result = session.run(query)
        return [record["name"] for record in result]

def extract_tables_from_question(question, available_tables):
    """Demande à l'IA d'identifier les tables nécessaires."""
    prompt = ChatPromptTemplate.from_messages([
    ("system", """Tu es un assistant expert en base de données. Ta seule tâche est d'analyser la question de l'utilisateur et de retourner une liste JSON des noms de tables nécessaires pour y répondre.
Les seules tables existantes sont : ["bronze.orders", "bronze.customers", "bronze.products", "bronze.order_payments", "bronze.order_items", "bronze.category_translation"].
IMPORTANT: Renvoie UNIQUEMENT un tableau JSON de chaînes de caractères. N'ajoute aucun texte.
Exemple : ["bronze.orders", "bronze.customers"]"""),
    ("human", "{question}")
])
    
    chain = prompt | llm | JsonOutputParser()
    try:
        tables = chain.invoke({"question": question, "tables": ", ".join(available_tables)})
        return tables
    except Exception as e:
        st.error(f"Erreur lors de l'extraction des tables: {e}")
        return[]

def get_join_schema(driver, selected_tables):
    """Récupère uniquement les règles de jointure (Foreign Keys)."""
    if len(selected_tables) <= 1:
        return "Pas de jointure nécessaire (une seule table ciblée)."

    query = """
    UNWIND $tables AS t1_name
    UNWIND $tables AS t2_name
    WITH t1_name, t2_name WHERE t1_name < t2_name
    MATCH (t1:Table {name: t1_name}), (t2:Table {name: t2_name})
    MATCH p = shortestPath((t1)-[:REFERENCES*]-(t2))
    UNWIND relationships(p) AS r
    WITH DISTINCT r
    WITH r, startNode(r) AS src, endNode(r) AS tgt
    RETURN src.name AS source, 
           r.from_column AS from_col, 
           r.to_column AS to_col, 
           tgt.name AS target
    """
    
    schema_text = ""
    with driver.session() as session:
        result = session.run(query, tables=selected_tables)
        records = list(result)
        if not records:
            return "Aucune relation de jointure trouvée dans Neo4j."
        for record in records:
            schema_text += f"JOIN ON {record['source']}.{record['from_col']} = {record['target']}.{record['to_col']}\n"
    return schema_text

def get_table_details(driver, selected_tables):
    """
    Récupère les colonnes exactes et les descriptions pour éviter les hallucinations.
    Cette requête extrait les propriétés de la table ET les noeuds Colonnes si vous en avez créés.
    """
    if not selected_tables:
        return ""

    query = """
    MATCH (t:Table)
    WHERE t.name IN $tables
    // On cherche les colonnes rattachées s'il y en a (noeud Column)
    OPTIONAL MATCH (t)-[]->(c:Column)
    RETURN t.name AS table_name, properties(t) AS table_props, collect(properties(c)) AS columns
    """
    
    details = ""
    with driver.session() as session:
        result = session.run(query, tables=selected_tables)
        for record in result:
            t_name = record["table_name"]
            t_props = record["table_props"]
            columns = [c for c in record["columns"] if c] # Nettoie les listes vides
            
            details += f"\n👉 TABLE: {t_name}\n"
            
            # Si les colonnes sont stockées comme des noeuds séparés
            if columns:
                for c in columns:
                    c_name = c.get("name", "inconnu")
                    c_desc = c.get("description", "Aucune description")
                    details += f"  - Colonne '{c_name}' (Description: {c_desc})\n"
            # Si les colonnes/descriptions sont stockées directement dans les propriétés de la table
            else:
                for key, value in t_props.items():
                    if key != 'name': # On ignore le nom qu'on a déjà affiché
                        details += f"  - {key}: {value}\n"
                        
    return details

def generate_sql(question, full_schema):
    """Génère la requête SQL finale avec des contraintes strictes."""
    prompt = ChatPromptTemplate.from_messages([
        ("system", """Tu es un expert SQL. Ta mission est de générer une requête SQL parfaite pour répondre à la question de l'utilisateur.
        
        RÈGLES STRICTES ET OBLIGATOIRES :
        1. N'INVENTE AUCUNE COLONNE. Tu ne dois utiliser QUE les colonnes qui apparaissent dans le schéma ci-dessous.
        2. Utilise les descriptions pour comprendre de quelle colonne l'utilisateur parle (Exemple: Si l'utilisateur demande la "localisation" et que la description d'une colonne "ltk" dit "localisation", utilise "ltk").
        3. Respecte les règles de jointure fournies.
        
        === CONTEXTE DE LA BASE DE DONNÉES (Jointures, Colonnes et Descriptions) ===
        {schema}
        ======================================================================
        
        Renvoie UNIQUEMENT le code SQL brut. Ne mets aucun texte explicatif. Ne mets pas de bloc markdown (```sql)."""),
        ("human", "{question}")
    ])
    
    chain = prompt | llm | StrOutputParser()
    return chain.invoke({"question": question, "schema": full_schema})

# ---------------------------------------------------------
# 3. INTERFACE UTILISATEUR STREAMLIT
# ---------------------------------------------------------

st.set_page_config(page_title="Générateur SQL avec Neo4j & OpenRouter", layout="wide")
st.title("⚡ Text-to-SQL RAG (Neo4j & Gemini Flash-Lite)")

question = st.text_input("Posez votre question (ex: 'Où se trouve le client de la commande X ?')")

if st.button("Générer la requête SQL"):
    if question:
        with st.spinner("Analyse sémantique via Graph RAG..."):
            
            # 1. Identifier les tables
            available_tables = get_all_tables(driver)
            target_tables = extract_tables_from_question(question, available_tables)
            st.write("### 🔍 Étape 1 : Tables identifiées")
            st.json(target_tables)
            
            # 2. Récupérer les jointures
            st.write("### 🔗 Étape 2 : Extraction des Jointures")
            join_schema = get_join_schema(driver, target_tables)
            st.code(join_schema, language="text")
            
            # 3. Récupérer les colonnes exactes et leurs descriptions sémantiques
            st.write("### 📖 Étape 3 : Extraction des Colonnes et Descriptions")
            table_details = get_table_details(driver, target_tables)
            st.code(table_details, language="text")
            
            # 4. Compilation du contexte final et génération SQL
            st.write("### 💻 Étape 4 : Requête SQL générée (Sans Hallucination)")
            full_context = f"--- RÈGLES DE JOINTURES ---\n{join_schema}\n\n--- DÉTAILS DES TABLES ET COLONNES ---\n{table_details}"
            sql_query = generate_sql(question, full_context)
            
            # Nettoyage Markdown
            sql_query = sql_query.replace("```sql", "").replace("```", "").strip()
            st.code(sql_query, language="sql")
    else:
        st.warning("Veuillez entrer une question.")