from typing import Annotated, List, TypedDict, Union, Any, Dict, Optional
from pydantic import BaseModel, Field
import operator

class AgentState(TypedDict):
    """
    État global du système circulant entre les agents.
    """
    # --- Entrées et Dialogue ---
    question: str
    messages: Annotated[List[str], operator.add]
    
    # --- Orchestration et UI ---
    plan: List[str]
    next_step: str
    status_update: str
    
    # --- Données Métier ---
    schema_context: str
    generated_sql: str
    query_results: Any
    errors: List[str]

# --- Modèles pour le Structured Output (LLM) ---

class PlannerOutput(BaseModel):
    """
    Modèle utilisé par le Planner pour structurer sa décision.
    """
    current_plan: List[str] = Field(description="Liste des étapes à suivre")
    next_node: str = Field(description="L'agent à appeler : retriever, generator, executor ou ask_user")
    status_message: str = Field(description="Message de progression pour l'utilisateur")

class SQLOutput(BaseModel):
    """
    Modèle utilisé par le Generator pour fournir un SQL propre.
    """
    sql: str = Field(description="La requête SQL générée")
    explanation: str = Field(description="Explication simple de la requête")