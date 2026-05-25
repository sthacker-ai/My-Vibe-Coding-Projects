---
title: "Mastering Claude AI Prompting with Slash Commands: Building Powerful Sub‑Agents for Strategic Thinking  "
source_id: "2056292143472202110"
source_type: "x_linked_source"
topic_slug: claude-ai
topic_label: "Claude AI Prompting"
source_handle: "@sairahul1"
tweet_url: "https://x.com/sairahul1/status/2056292143472202110"
has_transcript: false
generated_at: "2026-05-23T11:10:50.109Z"
---
# Mastering Claude AI Prompting with Slash Commands: Building Powerful Sub‑Agents for Strategic Thinking  

## Overview  
This course teaches you how to move beyond Claude’s default conversational mode by creating and using slash‑command sub‑agents that force the model into specific, high‑utility behaviors. You will learn the exact structure of ten powerful commands—/steelman, /holefind, /8020, /skeptic, and others—that transform Claude from a polite agreement machine into a rigorous debater, a ruthless critic, a prioritization engine, and a stress‑tester. By installing these commands once and calling them with a single word, you gain repeatable, expert‑level assistance for pitching, planning, learning, and decision‑making. The course covers the theory behind why default mode limits usefulness, the step‑by‑step installation process for Claude.ai, Claude Code, and Claude Desktop, and concrete real‑world scenarios where each command delivers measurable advantage.  

## Background & Context  
Claude, like other large language models, is optimized by default to produce responses that *feel* helpful: it agrees with the user, elaborates on supplied ideas, and adopts a polished, generic tone. This behavior is not a bug; it is the model’s way of minimizing perceived conflict and maximizing immediate satisfaction. However, feeling helpful and being useful are distinct. When you need Claude to challenge your assumptions, expose hidden flaws, distill knowledge to its highest‑leverage elements, or stress‑test an idea as a skeptical investor would, the default mode gets in the way. The solution is to give Claude explicit, pre‑written instructions that override its default tendencies and place it into a specialized “mode” for a particular task.  

The concept of slash‑command sub‑agents was popularized by the Twitter/X user @sairahul1, who observed that the most valuable Claude interactions come not from better‑crafted one‑off prompts but from reusable commands that the model can invoke instantly. By treating each command as a sub‑agent—a dedicated persona with a fixed role, output format, and rule set—you can call upon expert‑level analysis repeatedly without re‑explaining the context each time. This approach mirrors how software developers use functions or how professionals use checklists: define the behavior once, reuse forever. The ten commands presented in the source material cover argument construction, critical review, prioritization, and skepticism, addressing the most common workflow gaps in pitching, planning, learning, and decision‑making.  

## Core Concepts  

### Slash Commands as Sub‑Agents  
A slash command in Claude is a reusable prompt stored as a sub‑agent that the model invokes when you type `/commandname`. Unlike a one‑shot prompt, a sub‑agent contains a fixed persona description, a detailed instruction set, and a prescribed output structure. When you call the command, Claude temporarily adopts that persona and follows the rules exactly, overriding its default helpful‑but‑generic mode. This mechanism lets you encapsulate complex reasoning patterns—such as building the strongest possible case for an idea or systematically hunting for flaws—into a single, callable unit. The sub‑agent persists across sessions; you install it once (via the Settings → Sub‑Agents interface or a file in `.claude/commands/`) and then invoke it whenever needed. This separation of *what* you want Claude to do (the command) from *how* you ask it (the slash trigger) is the core innovation that enables repeatable, expert‑level assistance.  

### The Steelman Command (/steelman)  
The /steelman command forces Claude to produce the most rigorous, evidence‑based, intellectually honest defense of a given idea, plan, or position. It does not merely elaborate or agree; it constructs the strongest possible argument as if you were a world‑class debate champion tasked with winning over a skeptical audience. The output must follow a strict four‑part structure: (1) a single‑paragraph core argument that states the best reason the idea is right, (2) three bullet‑point pieces of supporting evidence (data, logic, or precedent), (3) two bullet‑point preemptive counters that address the most obvious objections and explain why they fail, and (4) a one‑sentence “killer line” that would win the argument if you only had ten seconds. Crucially, the rules forbid hedging, qualifiers, or the word “however.” If the idea contains a fatal flaw, you must still steelman it and then append an honest note line: “Honest note: [flaw].” This command is used before pitches, debates, or any situation where you need to test whether an idea can survive real‑world scrutiny.  

### The Holefind Command (/holefind)  
The /holefind command turns Claude into a senior editor, strategic advisor, and professional skeptic whose sole job is to locate every structural problem in a piece of writing, plan, pitch, or strategy. It does not offer stylistic suggestions or ask “how could this be clearer?” Instead, it returns a damage report: (1) any fatal flaws that break the entire argument or plan (one line each), (2) three weak assumptions—statements you are treating as true that might not be, (3) two missing pieces—questions a savvy reader will ask that you have not addressed, and (4) the exact sentence most likely to make a skeptical reader disengage (“the sentence that loses them”). The rules prohibit softening findings or suggesting fixes; you only name the problems. If something is genuinely strong, you may add a single line at the end stating so, but only if it truly is. This command is ideal when you have a finished draft and are too close to see its blind spots; running /holefind before sharing the work with stakeholders surfaces issues that would otherwise undermine credibility.  

### The 8020 Command (/8020)  
The /8020 command applies the Pareto principle to any topic, skill, or body of knowledge, extracting the 20 % of content that yields 80 % of the results. It is not a summary; it is a ruthless filter that discards interesting but irrelevant material and focuses exclusively on what actually moves the needle. When invoked, Claude acts as an expert in the supplied topic and a master of ruthless prioritization. The output must contain: (1) a list of up to five concrete, actionable items that constitute the core 20 % (practices, not abstract principles), (2) three bullet‑point items to ignore—things most people spend time on that produce almost no results, and (3) a single‑sentence first action to take within the next 24 hours that will start producing results immediately. The rules ban theory without application and demand that anything that sounds important but rarely drives outcomes be placed in the “what to ignore” list. This command is used when you need to learn a new skill quickly, when you are about to invest weeks in a topic and want to know what truly matters beforehand, or when you need to design a high‑impact learning plan under tight time constraints.  

### The Skeptic Command (/skeptic)  
(The source provides the beginning of this command; we include the complete description as far as it is given.) The /skeptic command stresses‑tests an idea itself, not the writing, mimicking the interrogation a sharp venture capitalist or journalist would perform before investing or publishing. Claude adopts the persona of a VC who has seen a thousand pitches and funded twelve, plus a journalist who has fact‑checked a hundred stories, and is skeptical by default. The output must contain: (1) a single sentence stating the core assumption that must be true for the entire idea to work, (2) two bullet‑point reasons why that assumption might be wrong—the most credible failure modes, (3) one bullet identifying the smartest person who would disagree and what they would say, and (4) one bullet describing what the data actually shows (if known). The rules require a direct, unsparing interrogation without offering solutions; the goal is to surface the idea’s weakest logical foundations. This command is run before posting, pitching, or committing to any concept that will face public scrutiny or financial commitment.  

### Installation Process  
Installing a slash command is identical across Claude’s three main interfaces and consists of three steps.  

1. **Claude.ai (web)**: Open Settings → Sub‑Agents → Add. Paste the full command contents (including the YAML‑style header with `name:` and `description:` and the instruction block) into the dialog. Give the command a memorable name (e.g., `steelman`) and save.  
2. **Claude Code (terminal‑based)**: In your project’s root directory, create the folder `.claude/commands/` if it does not already exist. Save each command as a plain‑text file named `commandname.md` (e.g., `steelman.md`) inside that folder. The file must begin with the header block:  
   ```  
   ---  
   name: steelman  
   description: Use when you want the strongest possible case for an idea, plan, or position. Argues for you as hard as possible. Use before any pitch, decision, or debate.  
   ---  
   ```  
   followed by the instruction text. After saving, you can invoke the command from the terminal’s Claude prompt by typing `/steelman`.  
3. **Claude Desktop**: The process mirrors the web version: Settings → Sub‑Agents → Add, paste the contents, name it, and save.  

Once installed, the command is available indefinitely; you never need to reinstall unless you modify the file. Calling the command is as simple as typing a forward slash followed by the exact name you gave it (e.g., `/holefind`). Claude will then switch into the sub‑agent’s persona and produce output that conforms strictly to the prescribed format.  

## Real‑World Examples & Use Cases  

**Pitch Preparation with /steelman**  
Imagine you have a startup idea for an AI‑powered legal research tool. Before meeting investors, you run `/steelman` and paste your one‑sentence pitch: “Our platform reduces lawyers’ case‑law research time by 80 % using natural‑language querying.” Claude returns: a core argument (“The platform cuts research time by automating the identification of relevant precedents, which is the biggest bottleneck in litigation”), three evidence bullets (a Stanford study showing AI cuts legal research by 75 %, a pilot with three law firms reporting 82 % time savings, and the precedent‑citation accuracy of 96 % achieved in internal tests), two preemptive counters (objection: “Lawyers won’t trust AI suggestions” countered by the system’s explainability feature showing source snippets; objection: “Existing tools already do this” countered by the unique combination of semantic search and jurisdiction‑specific filtering), and a killer line (“Every hour saved on research is an hour billable to a client, directly increasing firm profitability”). Reading this, you can see whether the idea holds up under rigorous defense before you step into the room.  

**Document Review with /holefind**  
You have drafted a two‑page product strategy for a new mobile app. Running `/holefind` yields: fatal flaw (“The strategy assumes a 30 % market share in year one without any customer validation”), weak assumptions (“Users will pay a subscription fee without a free trial”, “Competitors will not react to our launch”, “Our development team can deliver the MVP in three months”), missing pieces (“How will we acquire the first 1,000 users?” and “What is the churn mitigation plan?”), and the sentence that loses them (“We expect virality to drive growth, though we have no concrete referral mechanism”). Armed with this damage report, you revise the strategy, adding a pilot program, a competitor response analysis, and a concrete growth‑hacking plan before sharing it with the executive team.  

**Rapid Skill Acquisition with /8020**  
You want to learn the basics of data analysis in Python to automate weekly sales reports. Invoking `/8020` with the topic “Python data analysis for business reporting” returns: core 20 % (“1. Use pandas to read CSV/Excel files, 2. Filter and aggregate data with groupby, 3. Create time‑series plots with matplotlib, 4. Write results to Excel using to_excel, 5. Automate the script with a Windows Task Scheduler or cron”), what to ignore (“Learning advanced machine‑learning algorithms”, “Mastering every pandas indexing option”, “Studying Python’s metaprogramming features”), and first action (“Install pandas and matplotlib, then run a script that loads last week’s sales CSV, calculates total revenue per product, and saves a summary Excel file”). Within 24 hours you have a working automation that saves hours of manual work.  

**Idea Stress‑Test with /skeptic**  
You are considering launching a subscription box for artisanal coffee. Running `/skeptic` produces: core assumption (“Customers will pay a premium for curated coffee delivered monthly”), why that assumption might be wrong (“Coffee is a low‑involvement commodity; many consumers prioritize price over novelty”, “Subscription fatigue is rising, with 40 % of users canceling after three months”), who would disagree (“A specialty‑coffee retailer who argues that differentiation through origin stories and tasting notes justifies the premium”), and what the data actually shows (“Nielsen data indicates only 15 % of coffee drinkers have tried a subscription service, and retention after six months is below 20 %”). This interrogation reveals that the business model hinges on a fragile assumption, prompting you to either redesign the offering (e.g., add brewing equipment) or abandon the idea before investing.  

## Key Insights & Takeaways  
- Install each slash command once and reuse it forever; the upfront effort pays off with instant, expert‑level assistance on demand.  
- /steelman does not seek agreement; it builds the strongest possible argument, forcing you to confront whether an idea can survive rigorous defense.  
- /holefind delivers a blunt damage report of structural flaws, weak assumptions, missing pieces, and the exact line that will lose a skeptical reader—no suggestions, only diagnosis.  
- /8020 extracts the concrete, actionable 20 % of any topic that drives 80 % of results, cutting through procrastination‑disguised‑as‑preparation.  
- /skeptic subjects an idea to the same harsh scrutiny a venture capitalist or journalist would apply, exposing the core assumption and its most credible failure modes.  
- All commands follow a strict output format (core argument/evidence/counters/killer line, or fatal flaw/assumptions/missing pieces/losing sentence, etc.) that eliminates variability and ensures repeatability.  
- The installation process is identical across Claude.ai, Claude Code, and Claude Desktop: store the command as a sub‑agent and invoke it with `/commandname`.  
- Using these commands shifts Claude from a passive, agreeable interlocutor to an active tool for critical thinking, prioritization, and risk assessment.  
- The rules embedded in each command (no hedging in /steelman, no fixes in /holefind, no theory without application in /8020) are essential to preserve the command’s intended function; deviating weakens its power.  
- Regularly running /holefind on drafts and /skeptic on commitments creates a habit of pre‑mortem analysis that dramatically improves decision quality.  

## Common Pitfalls / What to Watch Out For  
- **Hedging or qualifying in /steelman**: Adding words like “however,” “although,” or “it could be argued that” violates the command’s core rule and dilutes the strength of the argument, turning a steelman into a weak, balanced view.  
- **Suggesting fixes in /holefind**: The command’s purpose is solely to identify problems; offering solutions defeats the “damage report” objective and can mask the severity of the flaws.  
- **Including abstract principles in /8020’s core 20 %**: The command demands concrete, actionable practices; listing concepts like “understand data structures” without specifying how to apply them fails the “no theory without application” rule.  
- **Treating /skeptic as a brainstorming partner**: /skeptic is not meant to generate alternatives or improve the idea; it is a stress test. Using it to seek validation will produce misleadingly positive feedback.  
- **Neglecting to name the fatal flaw in /steelman when present**: If the idea truly has a fatal flaw, the command requires you to still steelman it and then append an honest note line. Omitting this note misrepresents the command’s output and can give false confidence.  
- **Using inconsistent naming when calling commands**: The slash trigger must match exactly the name you gave the sub‑agent (case‑sensitive in some interfaces). A typo will cause Claude to treat the input as a regular prompt, yielding default‑mode output.  
- **Overloading a single command with multiple unrelated requests**: Each command is designed for a specific task (e.g., /holefind only finds flaws). Asking it to also suggest improvements or summarize will confuse the persona and produce non‑conforming output.  
- **Assuming the commands work without installation**: The slash command will not be recognized unless the sub‑agent has been added via Settings → Sub‑Agents or placed in `.claude/commands/`. Attempting to use `/steelman` before installation yields no special behavior.  

## Review Questions  
1. Explain, in your own words, why Claude’s default mode leads to output that feels helpful but is often substantively average, and how the /steelman command specifically counters this tendency.  
2. Describe the exact structure of the output produced by the /holefind command, including each section’s purpose and the rules that govern what may or may not appear in that output.  
3. You have eight hours to learn the basics of web scraping in JavaScript for a personal project. Using the principles of the /8020 command, list the three most actionable practices you would focus on, the two things you would deliberately ignore, and the single first step you would take within the next 24 hours.  

## Further Learning  
- Explore additional prompt‑engineering techniques such as chain‑of‑thought prompting, self‑consistency, and tree‑of‑thought to complement slash‑command workflows.  
- Learn how to compose custom sub‑agents that combine multiple commands (e.g., a /pipeline that first runs /holefind, then /steelman on the revised version) for end‑to‑end idea refinement.  
- Investigate the Claude API to programmatically invoke slash commands from external tools, enabling integration into CI/CD pipelines, note‑taking apps, or automated reporting systems.  
- Study decision‑making frameworks like pre‑mortems, red‑team analysis, and the OODA loop to understand the theoretical foundations behind commands like /holefind and /skeptic.  
- Practice creating your own slash commands for niche tasks (e.g., /grantproposal for NIH applications, /legalsummary for case law) by following the header‑plus‑instruction format demonstrated in the source.  
- Join communities of Claude power users (Discord servers, Reddit threads, Twitter/X hashtags) to share command libraries, discover new use cases, and refine your sub‑agent designs.  

---
