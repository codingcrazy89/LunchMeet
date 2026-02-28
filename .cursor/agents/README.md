# LunchMeet — 8 Parallel Agent Tasks

This folder contains task definitions for the 8 LunchMeet features. Use them to run 8 agents in parallel.

## How to Run 8 Agents in Parallel

1. **Revert to Configuration 1** (if you want to build from scratch):
   ```powershell
   git checkout -b restore-config-1 configuration-1
   ```

2. **Open 8 Composer tabs** in Cursor (Cmd/Ctrl + T or New Composer for each).

3. **Assign one task per tab** — In each tab, paste the content below as your first message:

   | Tab | Paste this prompt |
   |-----|-------------------|
   | 1 | Read `.cursor/agents/AGENT_01_CLOSE_LUNCH_CONFIRM.md` and implement the task. You have full permission to edit the specified files. |
   | 2 | Read `.cursor/agents/AGENT_02_PROFILE_FIELD_LABELS.md` and implement the task. You have full permission to edit the specified files. |
   | 3 | Read `.cursor/agents/AGENT_03_SAFETY_TIPS.md` and implement the task. You have full permission to create and edit the specified files. |
   | 4 | Read `.cursor/agents/AGENT_04_USER_RANKING.md` and implement the task. You have full permission to create and edit the specified files. |
   | 5 | Read `.cursor/agents/AGENT_05_VISIBILITY_FILTERING.md` and implement the task. You have full permission to create and edit the specified files. |
   | 6 | Read `.cursor/agents/AGENT_06_COHOST.md` and implement the task. You have full permission to create and edit the specified files. |
   | 7 | Read `.cursor/agents/AGENT_07_DIRECT_INVITES.md` and implement the task. You have full permission to create and edit the specified files. |
   | 8 | Read `.cursor/agents/AGENT_08_SOCIAL_AUTH.md` and implement the task. You have full permission to edit the specified files. |

4. **Run all 8** — Start each agent. They will work in parallel. Cursor uses git worktrees to isolate changes and avoid conflicts where possible.

5. **Merge results** — Review each agent's changes. Resolve any conflicts (e.g., if multiple agents touch LunchContext) and merge into your main branch.

## Task Order (if running sequentially)

For fewer conflicts, run in this order:
1. Agent 1 (close confirm) — no overlap
2. Agent 2 (profile labels) — no overlap  
3. Agent 3 (safety tips) — no overlap
4. Agent 5 (visibility) — touches LunchContext, host
5. Agent 6 (co-host) — touches LunchContext, host
6. Agent 4 (ratings) — touches LunchContext, multiple files
7. Agent 7 (invites) — touches LunchContext, multiple files
8. Agent 8 (social auth) — touches AuthContext, login

## Permissions

Each task file explicitly grants the agent **full permission** to create and edit the specified files. No additional approval is needed for the listed scope.
