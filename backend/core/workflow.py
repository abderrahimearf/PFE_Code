from langgraph.graph import StateGraph, END
from core.models import AgentState
from core.agents.planner import PlannerAgent
from core.agents.retriever import RetrieverAgent
from core.agents.generator import GeneratorAgent

def create_workflow(llm_client, db_path: str, model_path: str):
    """
    Assemble les agents dans un graphe d'états LangGraph.
    """
    
    # 1. Instanciation des agents
    # On passe les chemins de la base de connaissances au Retriever
    planner = PlannerAgent(llm_client)
    retriever = RetrieverAgent(db_path=db_path, model_path=model_path)
    generator = GeneratorAgent(llm_client)

    # 2. Initialisation du graphe
    workflow = StateGraph(AgentState)

    # 3. Ajout des Nœuds
    workflow.add_node("planner", planner)
    workflow.add_node("retriever", retriever)
    workflow.add_node("generator", generator)

    # 4. Configuration des Arêtes (Edges)
    workflow.set_entry_point("planner")

    # Logique conditionnelle basée sur 'next_step' mis à jour par le Planner
    workflow.add_conditional_edges(
        "planner",
        lambda state: state["next_step"],
        {
            "retriever": "retriever",
            "generator": "generator",
            "ask_user": END,
            "end": END
        }
    )

    # Retour systématique au Planner pour validation
    workflow.add_edge("retriever", "planner")
    workflow.add_edge("generator", "planner")

    # 5. Compilation
    return workflow.compile()