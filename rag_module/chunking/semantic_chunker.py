"""
Medical-Aware Semantic Chunker.
Splits clinical text and knowledge documents into coherent passages while
preserving sentence integrity, clinical context, and full provenance metadata.
"""
import re
from typing import List, Dict, Any, Optional, Union
from rag_module.config.rag_config import DEFAULT_CONFIG
from rag_module.knowledge.document_model import KnowledgeDocument, KnowledgeChunk


def split_into_sentences(text: str) -> List[str]:
    """
    Splits text into sentences using punctuation boundaries.
    Handles medical abbreviations and lists gracefully.
    """
    if not text:
        return []
    raw_sentences = re.split(r'(?<=[.!?])\s+|\n\n+', text)
    sentences = [s.strip() for s in raw_sentences if s.strip()]
    return sentences


def count_words(text: str) -> int:
    """Fast whitespace-based word count."""
    return len(text.split())


class SemanticChunker:
    """
    Robust sliding-window semantic chunker for medical documents.
    Ensures chunks do not exceed token/word boundaries and overlap is strictly bounded in words.
    """
    def __init__(
        self,
        chunk_size_words: int = DEFAULT_CONFIG.CHUNK_SIZE_WORDS,
        overlap_words: int = DEFAULT_CONFIG.CHUNK_OVERLAP_WORDS,
        min_chunk_char_len: int = DEFAULT_CONFIG.MIN_CHUNK_CHAR_LEN,
        target_words: Optional[int] = None
    ):
        self.chunk_size_words = target_words if target_words is not None else chunk_size_words
        self.overlap_words = overlap_words
        self.min_chunk_char_len = min_chunk_char_len

    def chunk_document(self, record: Union[Dict[str, Any], KnowledgeDocument]) -> List[Dict[str, Any]]:
        """
        Chunks a structured medical record or KnowledgeDocument into one or more
        metadata-enriched passages. Preserves question/title context and provenance.
        """
        if isinstance(record, KnowledgeDocument):
            doc_dict = record.to_dict()
        else:
            doc_dict = dict(record)

        doc_id = doc_dict.get("document_id") or doc_dict.get("doc_id") or doc_dict.get("qid") or "unknown_doc"
        qid = doc_dict.get("qid", doc_id)
        source_id = doc_dict.get("source_id", "MedQuAD")
        source_name = doc_dict.get("source_name", "NIH Medical Knowledge Base")
        publisher = doc_dict.get("publisher", "National Institutes of Health")
        url = doc_dict.get("source_url") or doc_dict.get("url", "")
        title = doc_dict.get("title") or doc_dict.get("focus", "")
        focus = doc_dict.get("focus", title)
        qtype = doc_dict.get("qtype") or doc_dict.get("section", "general")
        doc_type = doc_dict.get("document_type", "general_reference")
        domain = doc_dict.get("medical_domain", "general_medicine")

        # Determine main body content
        question = doc_dict.get("question", "")
        answer = doc_dict.get("answer", "")
        content = doc_dict.get("content", "")

        if not content and answer:
            body_text = answer
            header_prefix = f"Question: {question}\nAnswer: " if question else ""
        elif content:
            body_text = content
            header_prefix = ""
        else:
            return []

        body_word_count = count_words(body_text)

        # If body fits within single chunk budget, return atomically
        if body_word_count <= self.chunk_size_words:
            chunk_text = f"{header_prefix}{body_text}" if header_prefix else body_text
            if len(chunk_text.strip()) < self.min_chunk_char_len:
                return []
            return [{
                "chunk_id": f"{doc_id}-c0",
                "document_id": doc_id,
                "doc_id": doc_id,
                "qid": qid,
                "source_id": source_id,
                "source_name": source_name,
                "publisher": publisher,
                "url": url,
                "source_url": url,
                "title": title,
                "focus": focus,
                "qtype": qtype,
                "section": qtype,
                "document_type": doc_type,
                "medical_domain": domain,
                "chunk_index": 0,
                "total_chunks": 1,
                "text": chunk_text,
                "word_count": count_words(chunk_text),
                "char_count": len(chunk_text)
            }]

        # Split into sentences and slide window
        sentences = split_into_sentences(body_text)
        if not sentences:
            return []

        chunks_text_list = []
        current_sentences = []
        current_words = 0

        for sentence in sentences:
            sentence_words = count_words(sentence)
            
            # If a single sentence exceeds chunk size, split by words
            if sentence_words > self.chunk_size_words:
                if current_sentences:
                    chunks_text_list.append(" ".join(current_sentences))
                    current_sentences = []
                    current_words = 0
                
                words = sentence.split()
                for i in range(0, len(words), max(1, self.chunk_size_words - self.overlap_words)):
                    chunk_slice = " ".join(words[i:i + self.chunk_size_words])
                    chunks_text_list.append(chunk_slice)
                continue

            if current_words + sentence_words >= self.chunk_size_words and current_sentences:
                chunks_text_list.append(" ".join(current_sentences))
                
                # Overlap suffix in terms of WORDS
                overlap_sentences = []
                overlap_accumulated_words = 0
                for s in reversed(current_sentences):
                    s_w = count_words(s)
                    if overlap_accumulated_words + s_w <= self.overlap_words:
                        overlap_sentences.insert(0, s)
                        overlap_accumulated_words += s_w
                    else:
                        break
                
                current_sentences = overlap_sentences
                current_words = overlap_accumulated_words

            current_sentences.append(sentence)
            current_words += sentence_words

        if current_sentences:
            chunks_text_list.append(" ".join(current_sentences))

        final_chunks = []
        total_chunks = len(chunks_text_list)
        
        for idx, passage in enumerate(chunks_text_list):
            chunk_text = f"{header_prefix}{passage}" if header_prefix else passage
            if len(chunk_text.strip()) < self.min_chunk_char_len:
                continue
                
            final_chunks.append({
                "chunk_id": f"{doc_id}-c{idx}",
                "document_id": doc_id,
                "doc_id": doc_id,
                "qid": qid,
                "source_id": source_id,
                "source_name": source_name,
                "publisher": publisher,
                "url": url,
                "source_url": url,
                "title": title,
                "focus": focus,
                "qtype": qtype,
                "section": qtype,
                "document_type": doc_type,
                "medical_domain": domain,
                "chunk_index": idx,
                "total_chunks": total_chunks,
                "text": chunk_text,
                "word_count": count_words(chunk_text),
                "char_count": len(chunk_text)
            })

        return final_chunks

    def chunk_knowledge_document(self, doc: KnowledgeDocument) -> List[KnowledgeChunk]:
        """Chunks a KnowledgeDocument and returns typed KnowledgeChunk objects."""
        raw_chunks = self.chunk_document(doc)
        typed_chunks = []
        for c in raw_chunks:
            chunk = KnowledgeChunk(
                chunk_id=c.get("chunk_id", ""),
                document_id=c.get("document_id", doc.document_id),
                source_id=c.get("source_id", doc.source_id),
                source_name=c.get("source_name", doc.source_name),
                publisher=c.get("publisher", doc.publisher),
                title=c.get("title", doc.title),
                text=c.get("text", ""),
                source_url=c.get("source_url", doc.source_url),
                document_type=c.get("document_type", doc.document_type),
                medical_domain=c.get("medical_domain", doc.medical_domain),
                section=c.get("section", doc.section),
                chunk_index=c.get("chunk_index", 0),
                word_count=c.get("word_count", 0),
                char_count=c.get("char_count", 0),
                metadata=doc.metadata
            )
            typed_chunks.append(chunk)
        return typed_chunks

    def chunk_corpus(self, corpus: List[Union[Dict[str, Any], KnowledgeDocument]]) -> List[Dict[str, Any]]:
        """Chunks an entire corpus of documents into indexed passages."""
        all_chunks = []
        for record in corpus:
            all_chunks.extend(self.chunk_document(record))
        return all_chunks
