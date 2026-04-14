import os
from typing import List, Dict, Any, Optional
from langchain_community.graphs import Neo4jGraph
from core.interfaces import IGraphClient

class GraphClient(IGraphClient):
    def __init__(self):
        self.graph = Neo4jGraph(
            url=os.getenv("NEO4J_URI"),
            username=os.getenv("NEO4J_USERNAME"),
            password=os.getenv("NEO4J_PASSWORD")
        )

    def execute_cypher(self, query: str, params: Optional[Dict] = None) -> List[Dict]:
        return self.graph.query(query, params=params)

    def retrieve_subschema(self, entities: List[str]) -> str:
        query = """
        MATCH (t:Table) WHERE toLower(t.name) IN $entities
        OPTIONAL MATCH (t)-[:HAS_COLUMN]->(c:Column)
        OPTIONAL MATCH (t)-[:REFERENCES]->(t_linked:Table)
        RETURN t.name as Table, collect(DISTINCT c.name) as Cols, collect(DISTINCT t_linked.name) as Links
        """
        data = self.execute_cypher(query, {"entities": [e.lower() for e in entities]})
        
        output = "Schéma trouvé :\n"
        for r in data:
            output += f"- {r['Table']} ({', '.join(r['Cols'])})"
            if r['Links']: output += f" -> Lié à: {', '.join(r['Links'])}"
            output += "\n"
        return output