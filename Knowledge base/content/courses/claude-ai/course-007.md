---
title: "Prompt Engineering for Claude: Best Practices from Anthropic’s Applied AI Team  "
source_id: "2056389335641956517"
source_type: "x_video"
topic_slug: claude-ai
topic_label: "Claude AI"
source_handle: "@eng_khairallah1"
tweet_url: "https://x.com/eng_khairallah1/status/2056389335641956517"
has_transcript: true
generated_at: "2026-05-23T11:22:40.578Z"
---
# Prompt Engineering for Claude: Best Practices from Anthropic’s Applied AI Team  

## Overview  
This course walks you through the full process of designing effective prompts for Claude, as demonstrated in a live 24‑minute workshop led by Hannah and Christian from Anthropic’s Applied AI team. You will see how a simple, underspecified prompt can lead the model astray (e.g., interpreting a car‑accident form as a skiing incident) and how systematic refinements—adding task context, tone guidance, static background information, structured delimiters, step‑by‑step instructions, and few‑shot examples—transform the output into a confident, factual analysis. By the end of the course you will be able to construct production‑ready prompts that minimize guesswork, leverage prompt caching, and reliably elicit the desired behavior from Claude in real‑world scenarios such as insurance claim processing, document understanding, and multimodal reasoning.  

The workshop emphasizes that prompt engineering is an empirical, iterative science: you start with a hypothesis about what the model needs, test it, observe failures, and enrich the prompt with precisely the missing pieces. The techniques shown are directly applicable to any API‑based workflow where you want a single‑shot, high‑confidence response from Claude rather than a back‑and‑forth chat.  

## Background & Context  
Anthropic, the creator of the Claude family of language models, invests heavily in helping users communicate intent clearly to its models. The Applied AI team works directly with customers to solve concrete problems, and they have distilled their experience into a set of prompt‑engineering best practices that they share publicly—exactly as seen in this workshop. The scenario presented mirrors a real customer request: a Swedish insurance company needed to automatically extract facts from a standardized accident‑report form and a hand‑drawn sketch, then determine fault. Because the form never changes, it is ideal material for a system‑level prompt that can be cached.  

The workshop uses Claude 4 Solid (the latest model at the time of recording) with temperature set to 0 and a very large max‑token budget, ensuring deterministic output and removing artificial constraints that could truncate reasoning. This setup lets the instructors focus purely on the effect of prompt wording, not on sampling variability or token limits.  

Understanding why these practices matter requires recognizing that large language models are powerful pattern matchers but lack intrinsic grounding in your domain. Without explicit instructions, they will fill gaps with the most statistically probable continuations—hence the initial “skiing accident” misinterpretation. By providing the model with a clear role, detailed context about the static form, confidence constraints, and structured reasoning steps, you shift the model from guessing to performing a reliable, auditable task.  

## Core Concepts  

### Prompt Engineering  
Prompt engineering is the disciplined practice of crafting the input text that a language model receives so that it produces the desired output. It involves three intertwined activities: writing clear instructions, supplying the necessary context, and organizing that information in a way that the model can easily parse and use. In the workshop, Hannah defines it as “the way that we communicate with a language model and try to get it to do what we want.” The goal is to move beyond casual chatting and achieve a single‑shot, high‑fidelity execution of a well‑specified task.  

### Task Context  
Task context tells the model *what* it is supposed to do and *why* it is doing it. In the first version of the prompt, the instructors merely said “review an accident report form and determine what happened and who’s at fault.” Because no further framing was given, Claude defaulted to a familiar Swedish street name and guessed a skiing accident. Adding explicit task context—such as “You are an AI system that helps a human claims adjuster review car‑accident report forms written in Swedish”—anchors the model in the correct domain and prevents irrelevant associations.  

### Tone Context  
Tone context directs the model’s stylistic and epistemic attitude. The instructors wanted Claude to be *factual* and *confident*, and to *refrain from guessing* when uncertain. They encoded this by stating: “If Claude can’t understand what it’s looking at, we don’t want it to guess and just sort of mislead us. We want to make sure that any assessment … is as clear and as confident as possible.” This tone guidance reduces hallucinations and encourages the model to output a calibrated confidence level or to abstain when information is insufficient.  

### System Prompt vs. User Prompt  
The system prompt holds information that is constant across all invocations of a particular application, while the user prompt carries the variable content for each request. The workshop shows that the accident‑report form’s layout (17 checkboxes, vehicle A/B columns) never changes, making it perfect for the system prompt. By placing that static description there, the model can retrieve it instantly via prompt caching, saving compute and ensuring consistent interpretation of the form’s fields.  

### Prompt Structure (Task Description → Content → Instructions → Examples → Recap)  
Anthropic recommends a canonical order for the user‑side prompt:  

1. **Task description** – state the role and objective up front.  
2. **Content** – insert the dynamic data (here, the images of the form and sketch).  
3. **Detailed instructions** – a step‑by‑step list of how the model should process the content and reason.  
4. **Examples** – few‑shot demonstrations of input‑output pairs that illustrate the expected reasoning.  
5. **Recap / emphasis** – repeat the most critical constraints (e.g., “only output a conclusion if you are fully confident”).  

This structure mirrors how humans consume a briefing: first know the mission, then see the evidence, then get the procedure, then look at worked examples, and finally be reminded of the key rules.  

### Delimiters (XML Tags and Markdown)  
To help Claude parse distinct sections of a prompt, the instructors suggest using explicit delimiters. XML tags are especially powerful because they let you label a block (“<user_preferences> … </user_preferences>”) and later refer back to that label. Markdown is also understood by Claude and can be used for headings, lists, and code fences, but XML offers finer‑grained semantic tagging. In version 3 of their prompt, they wrapped the static form description in `<form_structure>` tags and the images in `<accident_evidence>` tags, making it trivial for the model to locate each piece.  

### Prompt Caching  
When a portion of the prompt (typically the system prompt) is identical across many calls, Anthropic’s API can cache that portion so that the model does not re‑encode it each time. The workshop highlights that the unchanging accident‑report form is an ideal candidate for caching, reducing latency and cost. By putting the form’s layout in the system prompt, the first request pays the full encoding cost, and subsequent requests reuse the cached representation.  

### Confidence and Factuality Constraints  
A recurring theme is the instruction to avoid speculative answers. The instructors explicitly tell Claude: “Do not make any claims that aren’t factual” and “Only set things when you’re in your confidence.” This can be implemented by asking the model to output a confidence score alongside its conclusion, or to return a special token like “UNCERTAIN” when the evidence does not meet a threshold.  

### Iterative Prompt Development  
The workshop treats prompt crafting as an empirical loop:  

1. Write an initial prompt.  
2. Run it and inspect the output.  
3. Identify gaps (e.g., missing domain knowledge, over‑guessing).  
4. Add the missing piece (task context, tone, static data, examples).  
5. Repeat until the output meets the desired criteria.  

Each version (V1 → V2 → V3) added a specific improvement, demonstrating how small, targeted edits compound into a robust prompt.  

### Role Specification  
Defining the model’s role (“You are an AI system that helps a human claims adjuster…”) serves two purposes: it narrows the model’s behavioral space and provides a natural place to inject tone and confidence guidance. The role acts as a mental model for the Claude, making it easier to reason about what information is relevant.  

### Temperature and Max Tokens  
Setting temperature to 0 eliminates randomness, ensuring deterministic output given the same prompt—a crucial property for debugging and for applications that require repeatability. A huge max‑token budget (effectively “no limit”) guarantees that the model is not cut off mid‑reasoning, which is especially important when the prompt includes lengthy static descriptions or multiple examples.  

### Use of Examples (Few‑Shot Learning)  
Providing one or two concrete examples of how to interpret the form and sketch helps Claude internalize the reasoning pattern. In the workshop, they showed an example where checkbox 1 was ticked for vehicle A and checkbox 12 for vehicle B, and they demonstrated the correct fault assignment. These examples act as a miniature chain‑of‑thought that the model can emulate.  

## How It Works / Step‑by‑Step  

**Step 1 – Establish a Baseline Prompt**  
Begin with the simplest possible instruction that captures the high‑level goal. In the workshop the baseline was:  

```
You are reviewing an accident report form and determining what happened and who’s at fault.
[Insert images of the form and sketch]
```

Running this with Claude 4 Solid (temperature 0, high max tokens) yielded a response that mentioned a skiing accident on “Schaff‑Mann‑Gothan” street—clearly off‑target because the model lacked domain framing.  

**Step 2 – Add Task Context**  
Prepend a sentence that specifies the exact role and setting:  

```
You are an AI system that helps a human claims adjuster review car‑accident report forms written in Swedish.
[Insert images of the form and sketch]
```

This alone shifted the model’s interpretation from skiing to a vehicular context, as evidenced by the output now correctly noting “car accident.”  

**Step 3 – Inject Tone Guidance**  
Add a clause that directs the model’s confidence behavior:  

```
You are an AI system that helps a human claims adjuster review car‑accident report forms written in Swedish.
Do not make any claims that aren’t factual. Only state a conclusion when you are fully confident.
[Insert images of the form and sketch]
```

When run, Claude began to hedge its answers, indicating uncertainty when the evidence was insufficient, rather than fabricating a story.  

**Step 4 – Move Static Form Description to the System Prompt**  
Create a system prompt that encodes the invariant layout of the accident‑report form:  

```
<system>
The accident‑report form always contains 17 checkboxes labeled 1‑17.
Column A corresponds to Vehicle A, column B to Vehicle B.
Checkbox 1 indicates “Vehicle A was parked,” checkbox 12 indicates “Vehicle B was turning left,” etc.
(Full list of meanings omitted for brevity but provided in the workshop.)
</system>
```

The user prompt now only needs to contain the variable images:  

```
<user>
[Insert images of the form and sketch]
</user>
```

Because the system prompt never changes, the API caches it, dramatically reducing the time Claude spends figuring out the form’s structure on each call.  

**Step 5 – Structure the User Prompt with Delimiters**  
Wrap the dynamic content in meaningful XML tags to aid parsing:  

```
<user>
<accident_evidence>
[Insert image of the accident‑report form]
[Insert image of the hand‑drawn sketch]
</accident_evidence>
</user>
```

Optionally, add a `<task_reminder>` tag that repeats the core instruction:  

```
<task_reminder>
Determine what happened and who is at fault, outputting only a factual conclusion if fully confident.
</task_reminder>
```

**Step 6 – Provide Step‑by‑Step Reasoning Instructions**  
Inside the user prompt (or as a separate `<instructions>` block) enumerate the reasoning steps:  

```
<instructions>
1. Examine the form image and note which checkboxes are ticked for Vehicle A and Vehicle B.
2. Map each ticked checkbox to its predefined meaning (provided in the system prompt).
3. Examine the sketch image to understand the spatial relationship and motion of the vehicles.
4. Combine the form data and sketch to reconstruct the sequence of events.
5. Based on the reconstructed events, determine which vehicle violated a traffic rule or failed to yield.
6. If the evidence does not allow a definitive conclusion, output “UNCERTAIN” instead of guessing.
</instructions>
```

**Step 7 – Add Few‑Shot Examples**  
Include one or two worked examples that follow the same format:  

```
<example>
<input>
Form: Vehicle A checkbox 1 ticked, Vehicle B checkbox 12 ticked.
Sketch: Shows Vehicle A rear‑ending Vehicle B while B is turning left.
</input>
<output>
Vehicle A is at fault for failing to maintain a safe distance and striking Vehicle B from behind.
</output>
</example>
```

**Step 8 – Recap Critical Constraints**  
End the prompt with a concise reminder of the most important rules:  

```
<recap>
- Only output a factual conclusion if you are fully confident.
- Do not speculate; if uncertain, return “UNCERTAIN”.
- Use the checkbox meanings from the system prompt.
</recap>
```

**Step 9 – Execute and Evaluate**  
Send the assembled prompt to Claude’s API with temperature 0 and a generous max‑token limit. Inspect the output: it should now correctly identify the accident scenario, reference the specific checkboxes, and either give a confident fault assignment or explicitly state uncertainty. If any shortfall remains, return to Step 2‑8 and add the missing piece.  

Through this iterative loop, the workshop moved from a wildly misguided first guess to a precise, trustworthy analysis—all without changing the underlying model, only by refining the prompt.  

## Real‑World Examples & Use Cases  

### Insurance Claim Automation (the workshop’s core example)  
A Swedish insurer receives thousands of PDF scans of accident‑report forms plus hand‑drawn sketches each day. By deploying the prompt described above, the system can automatically extract the checkbox data, interpret the sketch, and produce a preliminary fault determination. Human adjusters then review only the borderline cases, dramatically increasing throughput while maintaining accuracy.  

### Medical Image Report Triage  
A hospital wants to flag abnormal chest X‑rays for radiologist review. The system prompt would contain the standard radiology report template (sections for findings, impression, etc.) with fixed headings. The user prompt supplies the X‑ray image and a brief clinical note. Instructions guide Claude to: (1) locate any opaque lesions, (2) compare them to normal anatomy described in the system prompt, (3) produce a structured impression, and (4) output “URGENT” if a malignancy‑like pattern is found with high confidence, otherwise “ROUTINE”.  

### Legal Contract Clause Extraction  
A law firm needs to pull out liability, indemnity, and jurisdiction clauses from varied contracts. The system prompt encodes the typical clause numbering and heading styles used in their template contracts. The user prompt provides the raw contract text. Instructions tell Claude to: (1) locate headings matching “Liability”, “Indemnity”, “Governing Law”; (2) extract the full paragraph under each; (3) normalize phrasing to a standard format; (4) flag any missing clause as “NOT_PRESENT”. Few‑shot examples show how a clause might be split across pages or written in passive voice.  

### Multilingual Customer Support Ticket Classification  
A global e‑commerce company receives support tickets in 12 languages. The system prompt includes the list of possible issue categories (shipping, payment, product defect, etc.) with short definitions in each language. The user prompt supplies the ticket text. Instructions direct Claude to: (1) identify the language, (2) match the ticket’s intent to a category using the definitions, (3) output the category code and a confidence score, (4) if confidence < 0.8, output “NEEDS_HUMAN”.  

In each case, the static elements (form templates, taxonomies, definitions) go into the system prompt for caching, while the variable inputs (images, text, audio transcripts) go into the user prompt with clear delimiters and step‑by‑step reasoning.  

## Key Insights & Takeaways  

- Always begin a prompt with an explicit **task description** that states the model’s role and objective.  
- Supply **task context** (domain, setting, purpose) to prevent the model from defaulting to statistically probable but irrelevant associations.  
- Encode a **tone constraint** (factual, confident, no guessing) to reduce hallucinations and encourage calibrated uncertainty.  
- Place **invariant background information** (form layouts, taxonomies, templates) in the **system prompt** so it can be cached across calls.  
- Structure the user prompt using the sequence: **Task → Content → Instructions → Examples → Recap** for optimal comprehension.  
- Use **delimiters** such as XML tags to label sections (e.g., `<form_structure>`, `<accident_evidence>`) and enable the model to reference them later.  
- Provide **step‑by‑step reasoning instructions** that mirror how a human would solve the task; this guides the model’s internal chain‑of‑thought.  
- Include **few‑shot examples** that demonstrate the exact input‑output format you expect, especially for ambiguous or multi‑step tasks.  
- End with a **recap** of the most critical constraints (confidence threshold, output format) to reinforce them at generation time.  
- Set **temperature = 0** for deterministic output when repeatability is required, and allocate a **sufficient max‑token budget** to avoid truncation.  
- Treat prompt development as an **empirical loop**: run, inspect failure modes, add the missing piece (context, tone, structure, examples), and repeat.  
- Verify that the model respects the **confidence directive** by checking that it outputs “UNCERTAIN” or a low confidence score when evidence is insufficient, rather than fabricating an answer.  

## Common Pitfalls / What to Watch Out For  

- **Omitting task context** leads the model to guess based on priors (e.g., interpreting a Swedish form as a skiing incident).  
- **Leaving tone unspecified** encourages the model to produce fluent but possibly false statements when uncertain.  
- **Putting variable content in the system prompt** defeats caching and forces the model to re‑encode irrelevant static text each time.  
- **Using unstructured, free‑form instructions** makes it harder for the model to parse the required steps; the model may skip or misorder them.  
- **Forgetting to provide examples** leaves the model without a concrete pattern to emulate, increasing variability in output style.  
- **Neglecting to repeat critical constraints** at the end of the prompt can cause the model to drift toward earlier, less‑important parts of the input.  
- **Setting temperature too high** introduces randomness that can undermine confidence‑based checks and produce non‑deterministic results.  
- **Under‑allocating max tokens** may truncate the model’s reasoning chain, especially when the prompt includes long static descriptions or multiple examples.  
- **Overloading the prompt with irrelevant details** can distract the model and dilute the signal of the essential instructions.  
- **Assuming the model understands domain‑specific abbreviations** without defining them in the system prompt or examples.  

## Review Questions  

1. **Task Context:** Why did the initial prompt cause Claude to interpret the accident report as a skiing incident, and how does adding explicit task context correct this misunderstanding?  
2. **Prompt Structure:** List the five recommended sections of a user‑side prompt in order, and explain the purpose of each section with reference to the workshop’s accident‑report example.  
3. **Iterative Improvement:** Describe the specific change made between Version 2 and Version 3 of the prompt in the workshop, and state what deficiency in Version 2 that change was intended to address.  

## Further Learning  

- Explore Anthropic’s official prompting guide and the Claude API documentation for advanced features such as **tool use**, **chain‑of‑thought prompting**, and **prompt caching** details.  
- Study **few‑shot and zero‑shot learning** techniques to understand how many examples are needed for different task complexities.  
- Experiment with **temperature scaling** and **top‑p / top‑k sampling** to see how deterministic versus creative outputs affect confidence‑based workflows.  
- Investigate **multimodal prompting** best practices when combining images, audio, and text with Claude 3‑Vision or Claude 4‑Vision models.  
- Look into **reinforcement learning from human feedback (RLHF)** and how it shapes the model’s tendency to follow explicit instructions versus its priors.
