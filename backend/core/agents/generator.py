from core.models import AgentState
from core.interfaces import ILLMClient

class GeneratorAgent:
    def __init__(self, llm_client: ILLMClient):
        self.llm = llm_client

    def __call__(self, state: AgentState) -> dict:
        print("--- GENERATOR: Génération de la requête SQL ---")
        
        # Le prompt est maintenant ultra-strict pour éviter les phrases de politesse
        prompt = f"""
        Tu es un expert Postgres SQL pur.
        
        SCHÉMA DE LA BASE :
        {state['schema_context']}
        
        CONSIGNE : Génère la requête SQL pour répondre à : {state['question']}
        
        RÈGLES STRICTES :
        1. Retourne UNIQUEMENT le code SQL pur.
        2. PAS de balises Markdown (ne commence PAS par ```sql).
        3. PAS de texte avant ou après le code (pas de "Bonjour", pas de "Voici la requête").
        4. PAS de commentaires SQL (--).
        5. Utilise les codes techniques (ex: 'SEG05') si mentionnés dans le schéma.
        6. N'utilise JAMAIS de backticks (`).
        """
        
        # Appel au LLM
        # On met la température à 0 pour être le plus précis et le moins créatif possible
        response = self.llm.chat([{"role": "user", "content": prompt}], temperature=0)
        
        # Nettoyage de sécurité au cas où le LLM mettrait quand même des balises
        sql_clean = response.replace("```sql", "").replace("```", "").strip()
        
        return {
            "generated_sql": sql_clean,
            "status_update": "Requête SQL générée et prête à l'exécution.",
            "next_step": "end" # On informe le planner que le travail est fini
        }