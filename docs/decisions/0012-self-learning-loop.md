# ADR-0012: 自我學習迴圈的架構與記憶儲存位置

- 狀態: Accepted
- 日期: 2026-07-07
- 相關模組: agent-governance / rules / skills / memory
- 相關文件: [.agent/rules/learning.md](../../.agent/rules/learning.md)、[AGENTS.md](../../AGENTS.md)、[docs-router.md](../../.agent/rules/docs-router.md)

## 背景 (Context)

需要一套「可自我學習」的 AI 流程：agent 在任務中累積教訓，沉澱成可跨 session、跨 agent（Claude Code／Codex／Gemini）讀取的記憶，並在教訓重複出現時升級為正式規則或技能。設計參考〈AI Agent 7 層架構〉(<https://raymondhouch.com/lifehacker/digital-workflow/ai-agent-7-layer-architecture/>)：核心規則、技能、精煉記憶、使用者畫像、對話歷史、生命週期自動化、多平台門面。該文章只提供概念架構（作者明言實作細節未公開），具體迴圈設計（擷取→蒸餾→升級→修剪→驗證）為本專案自行制定。串接要求：以 CLAUDE.md @import 鏈掛載，讓規則在每個 session 自動生效。

## 考慮過的方案 (Options Considered)

1. **方案 A — 全由各 agent 的全域私有記憶承擔**（如 Claude Code 的 `~/.claude` auto-memory）：零新增檔案；但不進版控、Codex／Gemini 完全看不到、無法審查與回溯，違反本專案「決策可被下一個 session 讀到」的治理原則。
2. **方案 B — 記憶放 `docs/learning/`**：沿用既有 `docs/**` 白名單免改 `.gitignore`；但 `docs/` 是給人讀的產品／架構文件，agent 治理內容混入會污染文件區，且與 `.agent/` 既有治理邊界（core.md §1）不一致。
3. **方案 C — 記憶放 `.agent/learning/`，規則放 `.agent/rules/learning.md`，操作程序做成 `learn`／`evolve` skills**（選定）：治理內容集中在 `.agent/`，與既有 rules 架構同構；需在 `.gitignore` 白名單補 `.agent/learning/**`。

### 子決策

- **root `CLAUDE.md` 納入版控**：在 `.gitignore` 白名單加 `!CLAUDE.md` 並追蹤。與 frontend／backend 於 2026-07-03 force-add `CLAUDE.md` 的既有先例一致，且讓「CLAUDE.md @import 串接」在 fresh clone 後仍成立。被拒替代：維持 local-only（chain 只對本機有效，clone 後 Claude Code 讀不到專案規則鏈）。
- **第 4 層（使用者畫像）與第 5 層（對話歷史）映射既有設施**，不新建 `USER.md`／daily log：使用者畫像已由使用者全域設定與各 agent 全域記憶承擔，專案層偏好差異記在 MEMORY.md「協作偏好」段；對話歷史已由 git log、ADR、PR 描述、session 紀錄承擔。被拒替代：照文章原樣建 `USER.md` 與每日日誌（與既有設施重複、易腐化、增加維護負擔）。
- **自動化以規則層觸發為主，hooks 為選配**：擷取觸發寫在 always_on 的 learning.md §3，任何 agent 都適用；Claude Code hooks／排程只作提醒類增強。被拒替代：依賴 Claude Code hooks 作為主要機制（Codex／Gemini 無法受益，違反多平台門面層）。

## 決策 (Decision)

採方案 C，落地內容：

- `.agent/rules/learning.md`（always_on）：七層映射、迴圈定義、擷取觸發、蒸餾／升級／修剪規則、檔案格式、誠實性與安全邊界。
- `.agent/learning/MEMORY.md`（上限 50 條）＋ `.agent/learning/inbox.md`（未蒸餾收件匣）。
- `learn`／`evolve` skills：`.claude/skills/` canonical、`.codex/skills/` 同步副本。
- 串接：`CLAUDE.md` 新增 `@.agent/rules/learning.md`；`AGENTS.md` 規則載入表與強制啟動載入清單加入 learning.md；`docs-router.md` 加路由列；`core.md` §12 反思機制串接 inbox 擷取。
- `.gitignore` 白名單新增 `!CLAUDE.md`、`!.agent/learning/`、`!.agent/learning/**`。

## 理由 (Rationale)

- **安全性**：記憶檔進版控，因此 learning.md §7 明定禁止寫入秘密（token／密碼／連線字串／個資），環境變數只記名稱；此邊界寫進規則與兩個 skill。方案 A 雖然不進版控，但其「安全」來自不可見，代價是治理不可審查，整體劣於明文邊界。
- **維護性**：與既有 `.agent/rules/` ＋ skills ＋ ADR 三層治理同構，單一責任（inbox＝暫存、MEMORY＝精煉、rules/skills/ADR＝永久）；上限 50 條與「升級後刪除原條目」防止記憶膨脹與雙重維護。
- **效能**：always_on 檔案數 +1，learning.md 刻意精簡（格式與細節下放到儲存檔與 skills）；MEMORY.md 不在 always_on 鏈上，僅在擷取／回顧時載入。

## 被拒絕方案與原因 (Rejected Alternatives)

- 方案 A（全域私有記憶）：跨 agent 不可見、不進版控、無法審查回溯。
- 方案 B（`docs/learning/`）：破壞 `.agent/`＝治理、`docs/`＝專案文件的既有邊界。
- 照文章原樣新建 `USER.md`＋每日日誌：與既有設施重複，徒增腐化面。
- 以 Claude Code hooks 為主要自動化機制：Codex／Gemini 無法受益。

## 影響 (Consequences)

- 所有 agent 每個 session 多載入一份 always_on 規則（learning.md）。
- root repo 開始追蹤 `CLAUDE.md` 與 `.agent/learning/`；`evolve` 回顧後的記憶變更需以 `docs(learning): ...`／`chore(learning): ...` 提交。
- **`.claude/skills/learn`、`.claude/skills/evolve` 依 root repo 既有慣例（`.gitignore` 首行 `*` 未白名單 `.claude/`）不進版控，僅本機生效**；進版控的是 `.codex/skills/` 同步副本（與 commit-changes 等既有專案 skill 相同）。因此 fresh clone 後 `.claude/skills/` 為空，Claude Code 使用者需自 `.codex/skills/` 複製回來，或改由 always_on 的 learning.md ＋ inbox／MEMORY 檔案驅動迴圈（skill 只是操作捷徑，非迴圈的必要條件）。
- core.md §12 的反思產出從「只記在 PR/commit/plan」升級為「同時進入可累積的記憶迴圈」。
- 未來若記憶量成長超出單檔負荷，可再拆分分區檔案（屆時另立 ADR）。

## Supersedes / Superseded by

無。
