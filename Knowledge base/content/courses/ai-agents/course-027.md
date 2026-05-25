---
title: "Hermes Agent: Building High‑Leverage AI Agent Systems  "
source_id: "2055335043904492011"
source_type: "x_linked_source"
topic_slug: ai-agents
topic_label: "AI Agents"
source_handle: "@shannholmberg"
tweet_url: "https://x.com/shannholmberg/status/2055335043904492011"
has_transcript: false
generated_at: "2026-05-25T06:18:46.821Z"
---
# Hermes Agent: Building High‑Leverage AI Agent Systems  

## Overview  
This course walks you through the Hermes Agent framework as described by @shannholmberg on X (formerly Twitter). You will learn what makes Hermes Agent distinct—its dynamic model routing, continual voice‑learning, and seamless context handling—how it is architected as isolated Docker containers on a single VPS, and how to move from a single‑agent prototype to a fully automated agent fleet. By the end, you will be able to reproduce the setup, understand the control hierarchy, and apply Hermes Agent to real‑world workflows such as SEO content production or growth‑focused agent teams.  

## Background & Context  
Hermes Agent emerged from the need to extract maximum leverage from large language models while keeping operational overhead low. Traditional agent approaches either lock you into a single model size (wasting compute on simple tasks) or require manual model switching, which fragments context and increases cognitive load. @shannholmberg, a practitioner who runs a full “Hermes Agent company” on a single virtual private server, observed that the most valuable agents are those that can autonomously decide *which* model to call, *when* to call it, and *how* to preserve the user’s stylistic fingerprint across interactions.  

The framework was popularized through a series of tweets that detailed an organizational chart inspired by corporate departments, each implemented as an isolated Docker container. This design guarantees that a failure or misconfiguration in one agent does not cascade to others, while still allowing all agents to inherit a shared “company brain” containing vision, brand, audience, and product information. The accompanying setup guide by Nate Herk (cited as the most thorough guide on the internet) distills the architecture into twelve actionable lessons, making it accessible for anyone with basic VPS and Docker knowledge.  

Since its introduction, the Hermes Agent pattern has been adopted for niche use‑cases such as an SEO agent that executes a 21‑step pipeline from keyword seed to published article, and for community events like the Hermes Agent evening hosted with @NousResearch at Espressio HQ. The framework’s portability—managed via a simple `ssh hermes` alias—enables users to spin up isolated agents per project from a laptop or phone in under ten seconds, ensuring that context is never lost.  

## Core Concepts  

### Hermes Agent Definition  
A Hermes Agent is an AI‑agent framework that dynamically routes incoming tasks to the most appropriate language model based on two criteria: task complexity and estimated cost. Unlike static agent designs that pre‑select a model, Hermes continuously evaluates the input, predicts the required reasoning depth, and selects a model that balances performance with expense. This routing mechanism is the primary source of the framework’s “highest leverage” claim, because it ensures you never overpay for trivial queries nor under‑power complex reasoning.  

In practice, the routing logic can be implemented as a lightweight classifier or a heuristic scoring function that examines token length, presence of multi‑step instructions, or domain‑specific keywords. For example, a request to “summarize this paragraph” might be routed to a 7B‑parameter model, while a request to “draft a research paper outline with citations” would trigger a 70B‑parameter model. The framework also logs each routing decision, enabling offline analysis to refine the cost‑complexity model over time.  

### Voice and Preference Learning  
Hermes Agent continuously learns the user’s voice, tone, and stylistic preferences from every interaction. This learning is not a one‑time fine‑tuning pass; instead, the system maintains a persistent preference profile that is updated incrementally—often via lightweight reinforcement learning from human feedback (RLHF) or via prompt‑injection of user‑edited outputs. Over weeks or months, the agent begins to generate responses that mirror the user’s idiosyncrasies, such as preferred sentence length, favored jargon, or habitual sign‑offs.  

Because the preference profile is stored alongside the shared company brain, every agent—whether a specialist SEO writer or a customer‑support bot—inherits the same stylistic baseline. This guarantees brand consistency across departments without requiring each agent to be retrained from scratch. The learning process is designed to be privacy‑preserving: the profile remains on the VPS and is never uploaded to external APIs unless explicitly permitted.  

### Context Switching Without Loss  
A core promise of Hermes Agent is that it handles context switching “without” losing the thread of conversation. In traditional chatbots, moving from one topic to another often requires re‑introducing background information, leading to repetitive prompts and wasted tokens. Hermes Agent mitigates this by storing a compact, hierarchical context graph in the company brain. When a user shifts focus, the agent retrieves the relevant sub‑graph (e.g., the current project’s vision, audience, and recent outputs) and injects it into the prompt, preserving continuity while discarding irrelevant details.  

This mechanism is especially valuable in multi‑agent scenarios: an orchestrator agent can hand off a task to a specialist, and the specialist receives not only the immediate instruction but also the broader strategic context inherited from the company brain. The result is a seamless experience akin to talking with a colleague who remembers the project’s goals even after a brief interruption.  

### Organizational Chart – Four Layers on a Single VPS  
The Hermes Agent “company” is organized into four logical layers, each executed as an isolated Docker container on a single virtual private server (VPS). Isolation ensures that crashes, security issues, or resource spikes in one layer do not affect the others, while shared volumes or network interfaces enable communication.  

1. **Company Brain** – A read‑only repository (often a Git‑backed folder) containing the immutable strategic assets: vision statement, brand guidelines, customer personas, product catalog, and high‑level objectives. Every other layer mounts this folder at startup, guaranteeing that all agents operate from the same source of truth.  
2. **Orchestrator Hermes Agent** – The central decision‑maker that reads the company brain, evaluates incoming requests, and selects the appropriate department (specialist agent) to handle the task. It also performs the model‑routing logic based on complexity and cost.  
3. **Department Specialists** – One or more containers each dedicated to a functional area (e.g., SEO, copywriting, data analysis, customer support). Each specialist inherits the company brain and may have its own fine‑tuned models or prompt libraries.  
4. **Automated Agent Team (Optional)** – A higher‑order layer where the orchestrator can spawn temporary agents on‑the‑fly for ad‑hoc workflows, then tear them down after completion. This layer enables fully autonomous pipelines without permanent container overhead.  

Because all layers run on the same VPS, latency between them is minimal (typically sub‑millisecond over the loopback interface), and resource allocation can be finely tuned via Docker’s `--cpus` and `--memory` flags.  

### Shared Context and the Company Brain  
The company brain is the single source of truth that every agent reads from at runtime. It is typically structured as a YAML or JSON tree:  

```yaml
vision: "Democratize access to expert‑level SEO insights"
brand:
  tone: "authoritative yet approachable"
  colors: ["#0066CC", "#FFFFFF"]
audience:
  - role: "content marketer"
    seniority: "mid‑level"
  - role: "founder"
    seniority: "executive"
products:
  - name: "SEO Audit Tool"
    description: "Automated site‑wide technical SEO scanner"
```

When an agent starts, it mounts this file into its container’s filesystem (e.g., `/app/company_brain.yaml`) and loads it into memory. Any update to the vision or brand guidelines requires only a Git pull; agents automatically pick up the new values on their next startup, eliminating configuration drift.  

### Hermes SEO Agent – 21‑Step Pipeline Inside One Docker Container  
A concrete illustration of the framework’s power is the Hermes SEO agent, which executes an end‑to‑end content production pipeline comprising twenty‑one discrete steps, all encapsulated within a single Docker container. The steps include:  

1. **Keyword Seed Ingestion** – Accept a list of seed keywords from a CSV or API.  
2. **Search Volume Retrieval** – Query a keyword‑metrics API (e.g., Ahrefs, SEMrush) for volume and difficulty.  
3. **Competitor Analysis** – Scrape top‑10 SERP URLs for each keyword.  
4. **Content Gap Identification** – Compare competitor headings to identify missing subtopics.  
5. **Outline Generation** – Prompt the LLM to produce a hierarchical outline based on gaps.  
6. **Section‑wise Drafting** – For each outline node, request a paragraph‑level draft.  
7. **Fact‑Checking** – Cross‑reference claims with trusted sources via a retrieval‑augmented step.  
8. **Tone Adjustment** – Apply the learned voice profile to rewrite drafts in the brand tone.  
9. **Internal Linking Suggestion** – Recommend links to existing site pages.  
10. **Meta‑Tag Creation** – Generate title tags and meta descriptions within length limits.  
11. **Schema Markup Generation** – Produce JSON‑LD for FAQ or HowTo schemas.  
12. **Readability Scoring** – Run a readability algorithm (e.g., Flesch‑Kincaid) and iterate if needed.  
13. **Keyword Density Optimization** – Adjust keyword placement to stay within optimal ranges.  
14. **Plagiarism Check** – Run a similarity check against a corpus of published content.  
15. **Final Proofread** – Apply grammar and style correction models.  
16. **Output Formatting** – Convert draft to Markdown or HTML as required.  
17. **Version Control Commit** – Automatically commit the final artifact to a Git repo.  
18. **Notification Dispatch** – Slack or email alert to stakeholders.  
19. **Analytics Tagging** – Embed UTM parameters or tracking IDs.  
20. **Performance Baseline Logging** – Record baseline metrics for future A/B testing.  
21. **Cleanup** – Remove temporary files and reset the container state for the next run.  

Because each step is a distinct function call (often a separate LLM prompt or a small script), the agent can pause, resume, or rerun any step without re‑executing the entire pipeline. The isolation of the Docker container guarantees that dependencies (e.g., specific Python packages, API keys) do not leak into other agents on the same VPS.  

### Twelve Lessons from Nate Herk’s Setup Guide  
Nate Herk’s guide, referenced as the most thorough Hermes Agent setup tutorial, distills the architecture into twelve actionable lessons. While the original tweet does not list each lesson verbatim, the surrounding commentary implies the following topics are covered:  

1. **VPS Provisioning** – Choosing a provider, selecting an OS image, and configuring SSH access.  
2. **Docker Installation** – Installing Docker Engine, setting up the daemon to start on boot, and verifying with `docker run hello-world`.  
3. **Company Brain Repository** – Creating a private Git repo for vision, brand, audience, and product data; cloning it onto the VPS.  
4. **Orchestrator Agent Image** – Building a Dockerfile that installs the routing logic, loads the company brain, and exposes a simple HTTP or gRPC endpoint.  
5. **Specialist Agent Templates** – Parameterizing Dockerfiles for different departments (e.g., SEO, support) to avoid duplication.  
6. **Inter‑Container Communication** – Configuring a Docker bridge network (`hermesnet`) and using service discovery via container names.  
7. **Model Routing Implementation** – Writing a Python module that estimates token cost and complexity, then selects a model from a list (e.g., `llama2:7b`, `mixtral:8x7b`).  
8. **Voice Learning Loop** – Storing user‑edited outputs in a preference database and applying a simple exponential moving average to update style parameters.  
9. **Context Graph Storage** – Using a lightweight SQLite or Redis instance to persist the hierarchical context graph between runs.  
10. **Automated Agent Spawning** – Leveraging Docker SDK or `docker compose` to spin up short‑lived specialist containers on demand.  
11. **Monitoring and Logging** – Setting up Prometheus metrics (`hermes_requests_total`, `hermes_routing_latency_seconds`) and Loki logs for debugging.  
12. **Update Pipeline** – Creating a CI/CD workflow (e.g., GitHub Actions) that rebuilds images on pushes to the company brain repo and performs zero‑downtime rolling updates.  

These lessons collectively enable a practitioner to go from a bare VPS to a production‑grade Hermes Agent fleet in under an hour.  

### SSH Alias “ssh hermes” for Instant VPS Access  
To reduce friction, the author defines an SSH alias in their local `~/.ssh/config`:  

```
Host hermes
    HostName 203.0.113.42
    User root
    IdentityFile ~/.ssh/hermes_key
    ServerAliveInterval 30
    TCPKeepAlive yes
```

Running `ssh hermes` from a laptop or phone opens a shell directly onto the VPS, where the Docker daemon is already running. From there, a single command such as `docker compose up -d` brings up the entire Hermes stack, or `docker exec -it hermes_orchestrator /bin/sh` drops you into the orchestrator’s shell for debugging. This setup enables the claimed “under 10 seconds” management time, because the SSH connection reuses existing keys and the VPS is kept warm (no cold‑start latency).  

### Levels of Interaction with Hermes Agent  
The source outlines four progressive levels at which a user can engage with the Hermes Agent ecosystem:  

- **Level 1: One Agent** – Deploy a single specialist container (e.g., the SEO agent) and interact with it directly via a CLI or API. This is the simplest entry point, useful for prototyping a specific workflow.  
- **Level 2: Direct Specialist Agents** – Run multiple specialist containers simultaneously, each addressable by name (e.g., `hermes_seo`, `hermes_support`). The user chooses which specialist to call based on the task type, bypassing the orchestrator.  
- **Level 3: Orchestrator + Specialists** – Activate the orchestrator Hermes agent, which receives all incoming requests, consults the company brain, and delegates to the appropriate specialist. This level introduces automatic model routing and context inheritance.  
- **Level 4: Automated Agent Team** – Enable the orchestrator to dynamically spawn temporary agents for complex, multi‑step workflows (e.g., a product launch campaign) and automatically tear them down upon completion. This level represents full autonomy, where the user only defines high‑level goals.  

Each level builds on the previous one, adding layers of abstraction, automation, and leverage.  

### Control Hierarchy  
The control hierarchy in a Hermes Agent system flows from the user → SSH interface → orchestrator → specialist agents → language models. At the top, the user issues a high‑level intent (e.g., “publish a blog post about keyword X”). The orchestrator parses this intent, consults the company brain for vision and audience, estimates complexity, selects a model, and forwards the request to the chosen specialist. The specialist then executes its internal pipeline (which may involve multiple model calls) and returns the final artifact. Feedback from the user (e.g., edits, approval ratings) is fed back into the voice‑learning module, closing the loop.  

Visually:  

```
User
   ↓ (ssh hermes)
Orchestrator Hermes Agent
   ↓ (reads company brain, routes)
Specialist Agent (e.g., SEO)
   ↓ (internal steps, multiple LLM calls)
Language Model(s) (selected by complexity/cost)
   ↓ (output)
Specialist Agent (post‑processing)
   ↓ (returns to orchestrator)
Orchestrator → User (via SSH)
```

This hierarchy guarantees that strategic decisions (vision, brand) are never bypassed, while tactical decisions (model choice, prompt wording) remain optimally localized.  

### Setup Guide: Point Your Agent at the Repo  
A recurring instruction in the source is to “point your agent at the repo.” This means configuring each Docker container to mount the company brain repository at a known path and to pull the latest version on startup. A typical `docker-compose.yml` snippet looks like:  

```yaml
version: "3.8"
services:
  orchestrator:
    image: hermes/orchestrator:latest
    volumes:
      - ./company_brain:/app/company_brain:ro
    environment:
      - BRAIN_PATH=/app/company_brain/company_brain.yaml
    networks:
      - hermesnet
  seo:
    image: hermes/seo:latest
    volumes:
      - ./company_brain:/app/company_brain:ro
    environment:
      - BRAIN_PATH=/app/company_brain/company_brain.yaml
    networks:
      - hermesnet
networks:
  hermesnet:
    driver: bridge
```

When the user runs `docker compose up -d`, Docker clones (or pulls) the `company_brain` folder into each container’s `/app/company_brain` directory, mounts it read‑only, and sets the `BRAIN_PATH` environment variable so the agent knows where to find the vision, brand, audience, and product data. Updating the repo (`git pull`) and then running `docker compose up -d --build` propagates the changes without downtime.  

### Prototype → Production Methodology  
The source advocates a iterative methodology: begin with a minimal prototype (single agent, hard‑coded prompts), validate the core value proposition (time saved, output quality), then gradually introduce the framework’s sophistication. The steps are:  

1. **Prototype** – Build a single‑container agent that performs one end‑to‑end task (e.g., generate a meta description). Use a static model (e.g., `llama2:7b`) and ignore routing.  
2. **Measure** – Capture latency, token cost, and user satisfaction.  
3. **Add Routing** – Integrate the complexity‑cost classifier; compare results to the prototype.  
4. **Add Voice Learning** – Store user edits; observe improvements in tone consistency.  
5. **Add Company Brain** – Extract vision/audience into a shared file; verify that all agents inherit it.  
6. **Add Specialist Containers** – Split the monolith into orchestrator + specialist(s); test delegation.  
7. **Add Automated Spawning** – Enable the orchestrator to launch temporary agents for burst workloads.  
8. **Productionize** – Add monitoring, logging, CI/CD, and security hardening (non‑root users, read‑only filesystems).  

At each stage, the system remains functional, allowing incremental rollout without major rewrites.  

### Models Run on Hermes  
While the tweet does not enumerate every model, it implies a heterogeneous model zoo that the orchestrator can choose from. Typical choices include:  

- **Small, fast models** for low‑complexity tasks: `llama2:7b`, `mistral:7b`, `phi-2`.  
- **Medium models** for balanced reasoning: `mixtral:8x7b`, `llama2:13b`, `zephyr:7b`.  
- **Large, high‑capacity models** for complex, multi‑step reasoning: `llama2:70b`, `mixtral:8x22b`, `wizardlm:70b`.  

The orchestrator may also call external APIs (e.g., OpenAI GPT‑4, Anthropic Claude) when cost permits, treating them as additional options in the routing table. The decision logic factors in both the estimated token count (input + expected output) and a per‑model cost per 1k tokens (derived from provider pricing or local GPU power consumption).  

### Honest Trade‑offs  
The author acknowledges that Hermes Agent is not a silver bullet. Trade‑offs include:  

- **Operational Overhead** – Managing Docker images, networks, and a VPS requires sysadmin familiarity; pure SaaS solutions abstract this away.  
- **Cold‑Start Latency** – Although the VPS is kept warm, pulling a large model image (several GB) can add seconds to startup if the image is not cached.  
- **Model Licensing** – Some high‑performance models have restrictive licenses; users must ensure compliance when deploying them in a commercial context.  
- **Learning Curve** – Understanding the routing logic, voice‑learning update mechanism, and context‑graph maintenance takes time beyond simple prompt engineering.  
- **Resource Contention** – Running multiple large models concurrently on a single VPS can exhaust GPU
