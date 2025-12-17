---
name: analyze
description: Requirements analysis phase detailed rules; read when entering requirements analysis; includes requirement scoring, follow-up logic, code analysis steps
---

# Requirements Analysis - Detailed Rules

**Goal:** Verify requirement completeness, analyze code current state, provide foundation for solution design

**Execution Flow:**
```
Phase A (steps 1-4) → Critical checkpoint: Score ≥7 points?
  ├─ Yes → Execute Phase B (steps 5-6) → Output summary
  └─ No → Output follow-up questions → Wait for user supplement → Re-score or cancel
```

**Important:** When score < 7 points, prohibit executing Phase B, prohibit outputting summary, can only output follow-up format

---

## Phase A: Requirement Assessment

### Step 1: Check Knowledge Base Status

```yaml
Determination condition: Code files exist in working directory AND requirement is not "new project"
Execution method: Determine per G10 quick decision tree, read `kb` Skill if detailed operations needed
Issue marking: If knowledge base doesn't exist/doesn't qualify, mark issue (P1 read-only, don't create)
```

### Step 2: Acquire Project Context

```yaml
Execution method: Execute per G10 quick flow (check knowledge base first → scan codebase if insufficient)
Detailed rules: Read `kb` Skill if complete rules needed
Purpose: Provide complete project context for scoring and follow-up, avoid low-level questions
```

### Step 3: Requirement Type Determination

- Determine whether to trigger G8 product design principles (new project/new feature/major refactoring)
- Determine specific requirement type (new project initialization, major feature refactoring, regular feature development, technical changes, etc.)

### Step 4: Requirement Completeness Scoring 【Critical Checkpoint】

<requirement_scoring>
**Scoring Principles:**
- If project context acquisition completed, scoring should consider all acquired project information
- Strict scoring standards: Knowledge base and code scanning only provide technical context, cannot replace user requirement clarity
- Even if technical information sufficient, if user requirement itself ambiguous (e.g., "optimize code", "improve interaction"), still need follow-up

**Follow-up Rules:**
- Strictly avoid asking known information: Tech stack, framework, module structure, implementation details inferable from code
- Only ask user-related information: Specific requirements, business logic, expected results, priorities, constraints

**Scoring Dimensions (total 10 points):**
- Goal Clarity (0-3 points): Whether task goal is clear and specific
- Expected Results (0-3 points): Whether success criteria and deliverables are clear
- Boundary Scope (0-2 points): Whether task scope and boundaries are clear
- Constraints (0-2 points): Whether time, performance, business constraints explained

**Scoring Reasoning Process (completed in <thinking> tags, not output to user):**

```
<thinking>
1. Analyze scoring dimensions item by item:
   - Goal Clarity (0-3 points): [Analyze user requirement goal clarity] → [X points]
   - Expected Results (0-3 points): [Analyze whether success criteria clear] → [X points]
   - Boundary Scope (0-2 points): [Analyze whether task scope clear] → [X points]
   - Constraints (0-2 points): [Analyze whether constraints explained] → [X points]
2. List specific evidence supporting this score (quote user's original words)
3. Identify missing key information points
4. Calculate total: X/10 points
5. Determination: [Whether follow-up needed and reason]
</thinking>
```

**Execute based on reasoning result:**
- Score ≥7 points → Continue executing Phase B
- Score <7 points → Output follow-up format
</requirement_scoring>

### Follow-up Output Format (when score < 7 points)

Use unified output format, line start: `❓【HelloAGENTS】- Requirements Analysis`

Content format: Brief explanation (1-2 sentences, include current score) + blank line + flat question list (3-5 numbered) + closing

Prohibit display: Scoring dimension details, category titles, next step suggestions, file changes

**Example:**
```
❓【HelloAGENTS】- Requirements Analysis

Current requirement completeness score is 5/10 points, unable to clarify optimization goals and expected effects.

1. Which file or module's code do you want to optimize?
2. What specific problems exist that need optimization? (e.g., slow performance, code duplication, etc.)
3. What effect do you expect after optimization?
4. Are there specific performance metrics or time requirements?

Please answer by number, or enter "continue with existing requirements" to skip follow-up (may affect solution quality).
```

### Post-Scoring Processing

```yaml
Score ≥7 points: Continue executing Phase B

Score <7 points: Stop immediately, output follow-up, wait for response, don't execute Phase B
  Follow-up loop:
    - User supplements → Re-score → Continue if score ≥7 points, follow-up again if score <7 points
  User choice handling:
    - "Continue with existing requirements": Directly execute Phase B (no need to confirm again)
    - "Cancel":
      - Interactive confirmation mode: Output cancellation format per G6.2
      - Push mode: Clear MODE_FULL_AUTH/MODE_PLANNING, output cancellation format per G6.2
      - Cancellation output example:
        ```
        🚫【HelloAGENTS】- Cancelled

        Cancelled: Requirements Analysis
        ────
        🔄 Next Steps: Can re-describe requirements or perform other operations
        ```
  Mode handling:
    - Interactive confirmation mode: Meet condition → Phase B → Need confirmation to enter solution design after requirements analysis complete
    - Push mode: Pause continuous execution, meet condition → Phase B → Resume silent continuous execution
```

---

## Phase B: Code Analysis (only execute after score ≥7 points)

### Step 5: Extract Key Objectives and Success Criteria

- Extract key objectives: Refine core objectives from complete requirements
- Define success criteria: Clarify verifiable success criteria

### Step 6: Code Analysis and Technical Preparation

```yaml
Execution content:
  - Determine project scale (per G4 rules)
  - Locate relevant modules
  - Quality check: Mark outdated information, scan security risks and code smells
  - Problem diagnosis: Analyze logs or error information (if any)
  - Technical information gathering (if needed): Use web search or MCP tools (Context7) to get latest documentation and best practices

Deliverables: Project context information (tech stack, module structure, quality issues, technical constraints) for P2 solution design use
```

---

## Requirements Analysis Output Format

⚠️ **CRITICAL - Mandatory Requirements:**
- ALWAYS use G6.1 unified output format
- NEVER use free text to replace standard format
- MUST verify format completeness before output

**When score ≥7 points (after Phase A+B complete, output):**

Strictly call G6.1 unified output format, fill following data:

1. **Phase Name:** `Requirements Analysis`
2. **Phase Specific Content (≤5 key points):**
   - 📋 Complete requirement description (organized)
   - 🏷️ Requirement type: Technical change/Product feature
   - 📊 Requirement completeness score: X/10 points
   - 🎯 Key objectives and success criteria
   - 📚 Knowledge base status
3. **File Change List:**
   📁 Changes: None
4. **Next Step Suggestions:**
   - Interactive confirmation mode: Enter solution design? (Yes/No)
   - Push mode: Silently enter solution design

---

## Phase Transition Rules

```yaml
Score < 7 points: Loop follow-up until score ≥7 points or user cancels
Score ≥7 points AND Interactive confirmation mode: Output summary → Stop → Wait for confirmation
Score ≥7 points AND (MODE_FULL_AUTH=true OR MODE_PLANNING=true): Complete requirements analysis → Immediately silently enter solution design
```
