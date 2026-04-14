from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional

class ILLMClient(ABC):
    @abstractmethod
    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.0) -> str:
        pass

class IGraphClient(ABC):
    @abstractmethod
    def execute_cypher(self, query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def retrieve_subschema(self, entities: List[str]) -> str:
        pass

class ISQLClient(ABC):
    @abstractmethod
    def execute_query(self, sql_query: str) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def validate_sql(self, sql_query: str) -> Dict[str, Any]:
        pass