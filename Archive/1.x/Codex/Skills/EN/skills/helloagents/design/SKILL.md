---
name: design
description: Solution design phase detailed rules; read when entering solution design; includes solution ideation, task breakdown, risk assessment, solution package creation
---

# Solution Design - Detailed Rules

**Goal:** Ideate feasible solutions and formulate detailed execution plan, generate solution package under plan/ directory

**Prerequisites:** Requirements analysis completed (score ≥7 points)

**Important:** Solution design MUST create new solution package, applies to all modes (interactive confirmation/full authorization/planning command)

**Execution Flow:**
```
Solution ideation → [User confirmation/Continuous in push mode] → Detailed planning (create new solution package)
```

---

## Solution Ideation

### Action Steps

**1. Check Knowledge Base Status and Handle**
- Determine per G10 quick decision tree
- If need to create/rebuild knowledge base → Read `kb` Skill to execute complete flow

**2. Read Knowledge Base**
- Execute per G10 quick flow (check knowledge base first → scan codebase if insufficient)
- If need detailed rules → Read `kb` Skill

**3. Determine Project Scale**
- Execute per G4 rules

**4. Determine Requirement Type and Select Template**
- Determine whether to trigger product design principles per G8
- Technical change (G8 not triggered): Use basic template
- Product feature (G8 triggered): Use complete template (includes product analysis section)

**5. Product Perspective Analysis (execute when step 4 determined as "product feature")**
- User persona, scenario analysis, pain point analysis
- Value proposition, success metrics
- Humanistic care considerations

**6. Task Complexity Determination**

Meets any condition is complex task:
```yaml
- Requirement is "new project initialization" or "major feature refactoring"
- Involves architecture decisions
- Involves technology selection
- Multiple implementation paths exist
- Involves multiple modules (>1) or affected files >3
- User explicitly requests multiple solutions
```

**7. Solution Ideation**

<solution_design>
**Solution Evaluation Criteria:**
- Advantages
- Disadvantages
- Performance impact
- Maintainability
- Implementation complexity
- Risk assessment (includes EHRB)
- Cost estimation
- Whether follows best practices

**Solution Ideation Reasoning Process (completed in <thinking> tags, not output to user):**

```
<thinking>
1. List all possible technical paths
2. Evaluate each path's pros/cons, risks, costs one by one
3. Filter out 2-3 most feasible solutions
4. Determine recommended solution and reasons
</thinking>
```

**Execute based on reasoning result:**

**Complex Task (mandatory solution comparison):**
- Generate 2-3 feasible solutions
- Detailed evaluation of each solution
- Determine recommended solution and reasons
- Output format: Add "Recommended" identifier after recommended solution title
  - Example: "Solution 1 (Minimal Change Fix - Recommended)" vs "Solution 2 (Complete Refactor)"
- Interactive confirmation mode: Output solution comparison, ask user to choose
- Push mode: Choose recommended solution (don't output comparison)

**Simple Task:**
- Directly determine sole feasible solution
- Briefly explain solution
</solution_design>

### Solution Ideation Output Format (when waiting for user to select solution)

Line start: `❓【HelloAGENTS】- Solution Ideation`

**Output Content (≤5 key points):**
```
❓【HelloAGENTS】- Solution Ideation

- 📚 Context: [Project scale] | [Knowledge base status]
- 📋 Requirement type: [Technical change/Product feature]
- 🔍 Complexity: [Complex task] - [Determination basis]
- 💡 Solution comparison:
  - Solution 1: [Name - Recommended] - [One-line explanation]
  - Solution 2: [Name] - [One-line explanation]
- ⚠️ Risk alert: [If EHRB or major risks exist]

────
🔄 Next Steps: Please enter solution number (1/2/3) to select solution
```

**Detailed Solution Explanation:** If user needs detailed comparison, can expand after follow-up

### Solution Ideation Sub-phase Transition

```yaml
Complex task:
  Interactive confirmation mode:
    - User selects valid number (1-N) → Enter detailed planning
    - User refuses all solutions → Output re-ideation inquiry format
      - Confirm re-ideation: Return to solution ideation, re-ideate
      - Refuse: Prompt "Cancelled solution design", flow terminates
      - Other input: Ask again
  Push mode:
    - Select recommended solution → Immediately silently enter detailed planning

Simple task: Directly enter detailed planning
```

**Re-ideation Solution Inquiry Format:**
```
❓【HelloAGENTS】- Solution Confirmation

All solutions rejected.

[1] Re-ideate - Redesign solutions based on feedback
[2] Cancel - Terminate solution design

────
🔄 Next Steps: Please enter number to choose
```

---

## Detailed Planning

**Prerequisite:** User has selected/confirmed solution (from solution ideation)

**Important:** MUST create new solution package, use current timestamp, MUST NOT reuse legacy solutions in plan/

### Action Steps

**All file operations follow G5 silent execution specification**

**1. Create New Solution Package Directory**

```yaml
Path: plan/YYYYMMDDHHMM_<feature>/
Conflict handling:
  1. Check if plan/YYYYMMDDHHMM_<feature>/ exists
  2. If not exist → Create directly
  3. If exists → Use version suffix: plan/YYYYMMDDHHMM_<feature>_v2/
     (If _v2 also exists, increment to _v3, _v4...)
Example:
  - First creation: plan/202511181430_login/
  - Name conflict: plan/202511181430_login_v2/
```

**2. New Library/Framework Documentation Query (if needed)**
```yaml
Trigger condition: Solution involves third-party library/framework never used in project, or involves major version upgrade
Execution method: Use web search or MCP tools (Context7) to query latest documentation
Record location: Technical Solution section of how.md
```

**3. Generate Solution Files**

Read `templates` Skill to get templates, generate:
- `why.md` (Change proposal/Product proposal)
- `how.md` (Technical design + ADR)
- `task.md` (Task list)

**Task List Writing Rules:**
```yaml
Single task code change amount control:
  - Regular project: ≤3 files/task
  - Large project: ≤2 files/task
Verification tasks: Insert periodically
Security check: MUST include security check task
```

**4. Risk Avoidance Measure Formulation**
- Based on solution ideation risk assessment, formulate detailed avoidance measures per G9
- Interactive confirmation mode: Ask user
- MODE_FULL_AUTH=true OR MODE_PLANNING=true: Avoid risks
- Write to Security and Performance section of `how.md`

**5. Set Solution Package Tracking Variable**
```yaml
Set: CREATED_PACKAGE = Solution package path created in step 1
Purpose: Pass to development implementation in full authorization command to ensure executing correct solution package
```

---

## Solution Design Output Format

⚠️ **CRITICAL - Mandatory Requirements:**
- ALWAYS use G6.1 unified output format
- NEVER use free text to replace standard format
- MUST verify format completeness before output

Strictly call G6.1 unified output format, fill following data:

1. **Phase Name:** `Solution Design`
2. **Phase Specific Content (≤5 key points):**
   - 📚 Knowledge base status
   - 📝 Solution overview (complexity, solution explanation)
   - 📋 Change list
   - 📊 Task list overview
   - ⚠️ Risk assessment (if EHRB detected)
3. **File Change List:**
   - `helloagents/plan/YYYYMMDDHHMM_<feature>/why.md`
   - `helloagents/plan/YYYYMMDDHHMM_<feature>/how.md`
   - `helloagents/plan/YYYYMMDDHHMM_<feature>/task.md`
4. **Next Step Suggestions:**
   - Interactive confirmation mode: Enter development implementation? (Yes/No)
   - Planning command: Solution package generated, enter `~exec` to execute if needed
5. **Legacy Solution Reminder:**
   - Scan plan/ directory per G11
   - If legacy solution packages detected (exclude solution package created this time), display per G11 rules

---

## Phase Transition Rules

```yaml
Interactive confirmation mode:
  - Output summary (contains "🔄 Next Steps: Enter development implementation? (Yes/No)")
  - Stop and wait for user explicit confirmation
  - User response handling:
    - Explicit confirmation ("yes"/"continue"/"confirm", etc.) → Enter development implementation
    - Explicit refusal ("no"/"cancel", etc.) → Flow terminates
    - Feedback-Delta (provide modification feedback) → Handle per Feedback-Delta rules
    - Other input → Treat as new user requirement, re-determine per routing mechanism

Push mode:
  - Full authorization command: Complete solution design → Immediately silently enter development implementation
  - Planning command: Output overall summary → Stop → Clear MODE_PLANNING

Critical constraint (only following 3 situations can enter development implementation):
  1. User explicitly confirms after solution design complete
  2. Full authorization command (~auto, etc.) triggered and solution design completed
  3. Execution command (~exec, etc.) triggered and solution package exists in plan/
```
