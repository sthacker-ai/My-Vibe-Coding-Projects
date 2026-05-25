---
title: "Building a Permanent AI‑Powered Knowledge Base with Karpathy’s LLM Wiki Approach  "
source_id: "2055237756318781502"
source_type: "x_video"
topic_slug: machine-learning
topic_label: "Machine Learning"
source_handle: "@polydao"
tweet_url: "https://x.com/polydao/status/2055237756318781502"
has_transcript: false
generated_at: "2026-05-25T05:11:01.760Z"
---
# Building a Permanent AI‑Powered Knowledge Base with Karpathy’s LLM Wiki Approach  

## Overview  
This course teaches how to transform a static collection of documents into a self‑improving, AI‑driven knowledge base that answers questions without needing to prompt a model from scratch each time. Inspired by Andrej Karpathy’s suggestion to “make it build you a permanent knowledge base that grows smarter over time,” we explore the underlying machine‑learning techniques—retrieval‑augmented generation (RAG), vector embeddings, incremental indexing, and feedback loops—that enable a folder of files to become a living expert system. By the end of the course you will be able to design, implement, and maintain such a system for personal research, professional workflows, or educational purposes.  

## Background & Context  
The rapid growth of large language models (LLMs) has made it trivial to generate coherent text on demand, yet each interaction is stateless: the model does not retain information from previous queries unless explicitly re‑prompted. This limitation forces users to repeat context, waste tokens, and risk inconsistencies. Researchers and engineers have long sought ways to give LLMs a persistent memory. Early approaches included fine‑tuning models on new data, but this is costly, prone to catastrophic forgetting, and requires retraining for every update.  

Karpathy’s insight reframes the problem: instead of altering the model’s weights, keep the LLM fixed and augment it with an external, searchable knowledge store that can be updated simply by adding new documents. When a user asks a question, the system first retrieves the most relevant passages from the store, then feeds those passages (along with the query) to the LLM to generate a grounded answer. This pattern—known as Retrieval‑Augmented Generation (RAG)—decouples knowledge acquisition from model inference, allowing the knowledge base to grow incrementally while the LLM remains a stable reasoning engine.  

The concept fits squarely within the broader landscape of **memory‑augmented neural networks**, **semantic search**, and **personal knowledge management** tools (e.g., Notion, Obsidian, Roam Research). What distinguishes Karpathy’s LLM Wiki is the tight coupling of a modern LLM with a lightweight, folder‑based ingestion pipeline, making the approach accessible to beginners while still scalable to enterprise‑grade corpora.  

## Core Concepts  

### Permanent Knowledge Base  
A permanent knowledge base is a structured repository that persists across sessions and accumulates information over time without requiring retraining of the underlying model. Unlike a traditional database that stores raw records, this base stores **semantic representations** (embeddings) of text chunks alongside the original text, enabling similarity‑based retrieval. The permanence comes from two properties: (1) the stored embeddings are immutable unless explicitly deleted or updated, and (2) the retrieval mechanism can always locate the most relevant chunks for any new query. In Karpathy’s LLM Wiki, the knowledge base lives as a set of files in a folder; each new document dropped into the folder is automatically processed, embedded, and added to the index, making the base grow “smarter” as more content accumulates.  

### Retrieval‑Augmented Generation (RAG)  
RAG is a two‑stage pipeline: first, a **retriever** searches the knowledge base for documents that are semantically close to the user query; second, a **generator** (the LLM) conditions on those retrieved passages to produce an answer. The retriever typically uses dense vector embeddings (e.g., from Sentence‑Transformers or OpenAI’s ada‑002) and an approximate nearest‑neighbor index (FAISS, Annoy, or HNSW). The generator receives a prompt that concatenates the query with the top‑k retrieved passages, often formatted as:  

```
Answer the question using only the following context:
<context passages>
Question: <user query>
Answer:
```  

By grounding the LLM’s output in verifiable source text, RAG reduces hallucinations, improves factuality, and allows the model to leverage knowledge that was never seen during its pre‑training.  

### Document Ingestion Pipeline  
The ingestion pipeline transforms raw files (PDFs, Markdown, HTML, plain text) into searchable units. A typical pipeline includes:  

1. **File detection** – watch a folder for new or modified files (e.g., using `watchdog` in Python).  
2. **Text extraction** – convert each file to plain text (PDFMiner for PDFs, `markdown` library for .md, etc.).  
3. **Chunking** – split the text into overlapping segments (e.g., 500‑token chunks with 50‑token overlap) to preserve context while keeping each piece within the model’s token limit.  
4. **Embedding** – run each chunk through an embedding model to obtain a dense vector.  
5. **Indexing** – store the vector and its associated metadata (source file, chunk ID, timestamp) in a vector database.  
6. **Metadata logging** – record ingestion time for auditability and potential deletion policies.  

When a user drops a document into the watched folder, the pipeline runs automatically, ensuring the knowledge base stays up‑to‑date without manual intervention.  

### Continuous Learning / Feedback Loop  
Although the LLM’s weights remain fixed, the overall system can improve over time through a feedback loop:  

- **User feedback** – after receiving an answer, the user can upvote/downvote or edit the response.  
- **Reward signal** – positive feedback can be used to boost the retrieval score of the source chunks that contributed to a good answer (e.g., via a re‑ranking model).  
- **Active learning** – low‑confidence queries can trigger a request for human‑labeled examples, which are then added to the knowledge base as new documents.  
- **Periodic re‑indexing** – as the corpus grows, the indexing strategy (e.g., IVF‑PQ parameters in FAISS) may be tuned to maintain retrieval speed and accuracy.  

This loop makes the knowledge base “smarter” not by altering the LLM, but by refining what it retrieves and how it weighs evidence.  

## How It Works / Step‑by‑Step  

Below is a detailed, end‑to‑end workflow that implements Karpathy’s LLM Wiki using open‑source tools (Python, LlamaIndex, Sentence‑Transformers, and FAISS). Each step includes code snippets and explanations.  

### Step 1 – Prepare the Watch Folder  
Create a directory that will serve as the drop‑zone for documents.  

```bash
mkdir -p ~/llm_wiki/documents
```  

### Step 2 – Install Dependencies  
```bash
pip install llama-index sentence-transformers faiss-python watchdog tqdm
```  

### Step 3 – Define the Ingestion Function  
This function loads a file, extracts text, chunks it, embeds the chunks, and adds them to a FAISS index.  

```python
import os
from llama_index import SimpleDirectoryReader, VectorStoreIndex, StorageContext
from llama_index.embeddings import HuggingFaceEmbedding
from llama_index.vector_stores import FAISS
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
import time

# Initialize embedding model (e.g., all-MiniLM-L6-v2)
embed_model = HuggingFaceEmbedding(model_name="sentence-transformers/all-MiniLM-L6-v2")

# Set up FAISS vector store
faiss_vector_store = FAISS(faiss_index=None)  # Will be created on first add
storage_context = StorageContext.from_defaults(vector_store=faiss_vector_store)

def ingest_folder(folder_path: str):
    """Read all files in folder, create/update index."""
    documents = SimpleDirectoryReader(folder_path).load_data()
    index = VectorStoreIndex.from_documents(
        documents,
        embed_model=embed_model,
        storage_context=storage_context,
        show_progress=True,
    )
    # Persist index to disk for reuse
    index.storage_context.persist(persist_dir="./llm_wiki_index")
    print(f"Ingested {len(documents)} documents. Index saved.")

class DocHandler(FileSystemEventHandler):
    def on_created(self, event):
        if not event.is_directory:
            print(f"Detected new file: {event.src_path}")
            ingest_folder(os.path.dirname(event.src_path))

    def on_modified(self, event):
        if not event.is_directory:
            print(f"Detected modified file: {event.src_path}")
            ingest_folder(os.path.dirname(event.src_path))

def start_watching(folder_path: str):
    event_handler = DocHandler()
    observer = Observer()
    observer.schedule(event_handler, folder_path, recursive=False)
    observer.start()
    print(f"Watching {folder_path} for changes...")
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        observer.stop()
    observer.join()

if __name__ == "__main__":
    start_watching("~/llm_wiki/documents")
```  

**Explanation:**  
- `SimpleDirectoryReader` loads any supported file type (PDF, .txt, .md, etc.) from the folder.  
- `HuggingFaceEmbedding` creates 384‑dimensional vectors for each chunk.  
- `FAISS` vector store enables fast similarity search.  
- The `watchdog` observer triggers re‑ingestion whenever a file is added or changed, ensuring the index reflects the latest folder contents.  

### Step 4 – Query the Knowledge Base  
Once the index is built, you can query it with a simple function that retrieves top‑k chunks and passes them to an LLM (here we use OpenAI’s GPT‑4 via LlamaIndex’s wrapper).  

```python
from llama_index import load_index_from_storage
from llama_index.llms import OpenAI

# Load persisted index
storage_context = StorageContext.from_defaults(persist_dir="./llm_wiki_index")
index = load_index_from_storage(storage_context)

# Set up LLM (replace with your API key)
llm = OpenAI(temperature=0.0, model="gpt-4")
query_engine = index.as_query_engine(llm=llm, similarity_top_k=3)

def ask_question(question: str):
    response = query_engine.query(question)
    print(f"Answer: {response}")
    # Optionally show source nodes
    for node in response.source_nodes:
        print(f"Source: {node.node.metadata.get('file_path', 'unknown')} "
              f"(score: {node.score:.3f})")

# Example usage
if __name__ == "__main__":
    ask_question("What are the main challenges of deploying LLMs in production?")
```  

**Explanation:**  
- `similarity_top_k=3` retrieves the three most relevant chunks.  
- The query engine builds a prompt that injects those chunks as context before asking the LLM to answer.  
- Source nodes are returned so users can verify the answer’s provenance.  

### Step 5 – Optional Feedback Integration  
To implement a rudimentary feedback loop, store user ratings in a SQLite table and adjust retrieval scores via a simple re‑ranking heuristic.  

```python
import sqlite3
conn = sqlite3.connect("feedback.db")
c = conn.cursor()
c.execute('''CREATE TABLE IF NOT EXISTS feedback
             (chunk_id TEXT PRIMARY KEY, upvotes INTEGER DEFAULT 0, downvotes INTEGER DEFAULT 0)''')
conn.commit()

def record_feedback(chunk_id: str, upvote: bool):
    c.execute("SELECT upvotes, downvotes FROM feedback WHERE chunk_id=?", (chunk_id,))
    row = c.fetchone()
    if row is None:
        up, down = (1,0) if upvote else (0,1)
        c.execute("INSERT INTO feedback VALUES (?,?,?)", (chunk_id, up, down))
    else:
        up, down = row
        if upvote:
            up += 1
        else:
            down += 1
        c.execute("UPDATE feedback SET upvotes=?, downvotes=? WHERE chunk_id=?", (up, down, chunk_id))
    conn.commit()

def get_re_rank_bonus(chunk_id: str) -> float:
    c.execute("SELECT upvotes, downvotes FROM feedback WHERE chunk_id=?", (chunk_id,))
    row = c.fetchone()
    if row is None:
        return 0.0
    up, down = row
    # Simple logistic‑style bonus: more upvotes increase score, downvotes decrease
    return (up - down) * 0.1
```  

During query time, after retrieving the initial FAISS results, add `get_re_rank_bonus` to each chunk’s score before selecting the top‑k. This makes the system favor documents that users have previously found helpful.  

## Real‑World Examples & Use Cases  

### 1. Personal Research Assistant  
A graduate student drops PDFs of journal articles, conference proceedings, and their own notes into the `~/llm_wiki/documents` folder. Over weeks, the index grows to hundreds of papers. When preparing a literature review, the student asks, “What are the common evaluation metrics used in few‑shot learning studies?” The system retrieves the most relevant paragraphs from recent papers, cites them, and synthesizes a concise answer, saving hours of manual skimming.  

### 2. Legal Knowledge Base for a Small Firm  
A law firm stores contracts, case law summaries, and internal memos as Markdown files. Junior lawyers can query, “What clauses are typically included in a SaaS service level agreement?” The LLM Wiki pulls relevant contract excerpts, highlights variations, and suggests standard language, reducing reliance on senior partners for routine questions.  

### 3. Enterprise Technical Support  
A tech company maintains a folder of product manuals, troubleshooting guides, and past support tickets (anonymized). Support engineers ask, “How do I reset the firmware on device XYZ after a failed update?” The system returns the exact step‑by‑step procedure from the manual, plus a relevant ticket where a similar issue was resolved, enabling faster resolution and consistent answers.  

### 4. Learning Companion for Online Courses  
An educator uploads lecture slides, transcripts, and recommended readings for a machine‑learning course. Students can ask, “Explain the bias‑variance tradeoff in the context of deep neural networks.” The LLM Wiki retrieves the relevant slide excerpt and a concise explanation from the transcript, providing an on‑demand study aid that adapts as new materials are added.  

## Key Insights & Takeaways  

- **Decouple knowledge from model weights**: Keeping the LLM static and storing knowledge externally avoids costly retraining and catastrophic forgetting.  
- **Folder‑based ingestion is sufficient for many use cases**: A simple watch‑folder pipeline can automate indexing without requiring a complex CMS.  
- **Dense vector embeddings enable semantic search**: Unlike keyword matching, embeddings capture meaning, allowing retrieval of relevant content even when wording differs.  
- **Chunk size and overlap matter**: Too large a chunk wastes tokens and dilutes relevance; too small loses context. A typical range is 400‑600 tokens with 40‑80 token overlap.  
- **Persistence is crucial**: Saving the FAISS index to disk lets you restart the service without reprocessing the entire corpus.  
- **Feedback loops improve relevance over time**: Even lightweight upvote/downvote signals can bias retrieval toward higher‑quality sources.  
- **Transparency builds trust**: Returning source citations lets users verify answers and reduces hallucination risk.  
- **Scalability considerations**: For corpora beyond a few hundred thousand chunks, consider hierarchical indexing (e.g., IVF‑PQ in FAISS) or a managed vector database (Pinecone, Weaviate).  
- **Privacy and security**: Since the knowledge base stores raw text, ensure the folder is access‑controlled and consider encrypting sensitive documents before ingestion.  

## Common Pitfalls / What to Watch Out For  

- **Stale or contradictory information**: If you add newer documents that conflict with older ones, the system may return both, leading to confusing answers. Implement a versioning or de‑duplication strategy (e.g., keep only the latest version of a file).  
- **Embedding drift**: Changing the embedding model mid‑cycle breaks vector compatibility; you must re‑index the entire corpus whenever you switch models.  
- **Over‑reliance on the LLM’s reasoning**: The LLM may still hallucinate even when given correct context, especially with ambiguous prompts. Always verify critical answers against the source citations.  
- **Ignoring metadata loss**: Some file types (e.g., scanned PDFs) lose structural information during text extraction, harming chunk quality. Use OCR where needed and preserve original file paths as metadata.  
- **Neglecting chunk boundaries**: Cutting sentences mid‑thought can produce nonsensical context. Use semantic chunking algorithms (e.g., splitting on paragraph or section headers) when possible.  
- **Performance bottlenecks**: Linear scan over a large FAISS index becomes slow; ensure you configure appropriate index parameters (nlist, nprobe) for your dataset size.  
- **Feedback gaming**: Malicious users could upvote misleading content to boost its rank. Combine feedback with source credibility checks (e.g., domain authority, date).  
- **Legal and ethical compliance**: Ingesting copyrighted material without permission may violate law. Limit the knowledge base to documents you have rights to use, or apply summarization/transformation that falls under fair use where appropriate.  

## Review Questions  

1. **Explain why a permanent knowledge base built via folder ingestion avoids the need for fine‑tuning the LLM, and discuss one advantage and one limitation of this approach compared to direct model fine‑tuning.**  
2. **Describe the step‑by‑step process that occurs when a new PDF is dropped into the watched folder, from file detection to the point where its content can be retrieved in a query.** Include the roles of text extraction, chunking, embedding, and indexing.  
3. **Imagine you are deploying this system for a hospital’s internal knowledge base containing patient‑education brochures and clinical guidelines. Identify two specific pitfalls from the “Common Pitfalls” list that are especially relevant in this setting, and propose concrete mitigation strategies for each.**  

## Further Learning  

- **Advanced Retrieval Techniques**: Study hybrid search (combining BM25 keyword scores with dense vectors), re‑ranking with cross‑encoders, and learned sparse embeddings (e.g., SPLADE).  
- **Vector Database Options**: Explore managed services like Pinecone, Milvus, Weaviate, and cloud‑native offerings (Azure Cognitive Search, Amazon Kendra) for scaling beyond FAISS’s limits.  
- **LLM Agents and Tool Use**: Learn how to augment the LLM Wiki with external tools (calculators, APIs, code executors) using frameworks like LangChain or LlamaIndex Agents.  
- **Evaluation Metrics for RAG**: Familiarize yourself with metrics such as Recall@K, Mean Reciprocal Rank (MRR), Faithfulness, and Answer Relevancy to objectively assess your system’s performance.  
- **Privacy‑Preserving Embeddings**: Investigate techniques like differential privacy, secure multi‑party computation, or homomorphic encryption to protect sensitive data while still enabling similarity search.  
- **Continuual Learning Paradigms**: Read about recent research on retrieval‑augmented generation with online updating, memory networks, and prompt‑based adaptation methods that keep the model’s behavior current without weight updates.  

By mastering these topics, you will be able to design robust, evolving AI knowledge assistants that serve as reliable, long‑term companions for any information‑intensive task.
