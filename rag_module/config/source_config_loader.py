"""
Configuration Loader for Healthcare Knowledge Sources.
Loads declarative JSON configuration for source enablement, allowlists,
batch sizes, rate limits, and output destinations.
"""
import json
from pathlib import Path
from dataclasses import dataclass, field
from typing import Dict, List, Any, Optional

from rag_module.config.rag_config import DEFAULT_CONFIG


@dataclass
class SourceExecutionConfig:
    """Execution parameters for an individual knowledge source."""
    source_id: str
    enabled: bool = True
    authority_level: str = "tier_1_federal_research"
    allowlist: List[str] = field(default_factory=list)
    domains: List[str] = field(default_factory=list)
    batch_size: int = 50
    rate_limit_delay_sec: float = 0.0
    output_subdir: str = ""


class IngestionConfigManager:
    """
    Manages declarative source configuration from file or runtime overrides.
    """
    DEFAULT_CONFIG_PATH = Path(__file__).resolve().parent / "sources_config.json"

    def __init__(self, config_path: Optional[Path] = None):
        self.config_path = config_path or self.DEFAULT_CONFIG_PATH
        self.sources: Dict[str, SourceExecutionConfig] = {}
        self.version: str = "2.4"
        self.default_batch_size: int = 50
        self.load_config()

    def load_config(self) -> None:
        """Loads configuration from JSON file."""
        if not self.config_path.exists():
            return

        with open(self.config_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        self.version = data.get("version", "2.4")
        self.default_batch_size = data.get("default_batch_size", 50)
        
        raw_sources = data.get("sources", {})
        for sid, scfg in raw_sources.items():
            self.sources[sid] = SourceExecutionConfig(
                source_id=sid,
                enabled=scfg.get("enabled", False),
                authority_level=scfg.get("authority_level", "tier_1_federal_research"),
                allowlist=scfg.get("allowlist", []),
                domains=scfg.get("domains", []),
                batch_size=scfg.get("batch_size", self.default_batch_size),
                rate_limit_delay_sec=scfg.get("rate_limit_delay_sec", 0.0),
                output_subdir=scfg.get("output_subdir", sid.lower())
            )

    def is_source_enabled(self, source_id: str) -> bool:
        """Checks if a source is enabled for ingestion."""
        cfg = self.get_source_config(source_id)
        return cfg.enabled if cfg else False

    def get_source_config(self, source_id: str) -> Optional[SourceExecutionConfig]:
        """Retrieves execution config for a source ID (case-insensitive)."""
        if source_id in self.sources:
            return self.sources[source_id]
        for sid, cfg in self.sources.items():
            if sid.lower() == source_id.lower():
                return cfg
        return None

    def set_source_enabled(self, source_id: str, enabled: bool) -> None:
        """Enables or disables a source at runtime."""
        cfg = self.get_source_config(source_id)
        if cfg:
            cfg.enabled = enabled
        else:
            self.sources[source_id] = SourceExecutionConfig(source_id=source_id, enabled=enabled)
