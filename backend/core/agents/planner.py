from core.models import AgentState, PlannerOutput
from core.interfaces import ILLMClient

class PlannerAgent:
    def __init__(self, llm_client: ILLMClient):
        self.llm = llm_client

    def __call__(self, state: AgentState) -> dict:
        print("--- PLANNER: Décision de la prochaine étape ---")
        
        # Logique de planification simple
        if not state.get("schema_context"):
            next_step = "retriever"
            msg = "Je commence par chercher les tables nécessaires dans la base de connaissances."
        elif not state.get("generated_sql"):
            next_step = "generator"
            msg = "J'ai le contexte, je vais maintenant générer la requête SQL."
        else:
            next_step = "end"
            msg = "La requête est prête."

        return {
            "next_step": next_step,
            "status_update": msg,
            "plan": state.get("plan", []) + [next_step]
        }