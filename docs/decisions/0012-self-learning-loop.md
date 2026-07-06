# ADR-0012: 自我學習迴圈的架構、全域／專案分層與記憶儲存位置

- 狀態: Accepted
- 日期: 2026-07-07
- 相關模組: agent-governance / rules / skills / memory
- 相關文件: [.agent/rules/learning.md](../../.agent/rules/learning.md)、全域 `~/.claude/rules/learning.md`、[AGENTS.md](../../AGENTS.md)、[docs-router.md](../../.agent/rules/docs-router.md)

## 背景 (Context)

需要一套「可自我學習」的 AI 流程：agent 在任務中累積教訓，沉澱成可跨 session 讀取的記憶，並在教訓重複出現時升級為正式規則或技能。設計參考〈AI Agent 7 層架構〉(<https://raymondhouch.com/lifehacker/digital-workflow/ai-agent-7-layer-architecture/>)。該文章只提供概念架構（作者明言實作細節未公開），具體迴圈設計（擷取→蒸餾→升級→修剪→驗證）為自行制定。

**關鍵範圍需求**：使用者要求此流程為**全域**（跨所有專案共用），不僅限 OneShort。因此機制（規則、skills、通用記憶）須放在使用者全域 `~/.claude/`，OneShort 只保留專案特化與專屬記憶。這將原本純專案內的設計改為「全域機制層 ＋ 專案特化層」兩層。

## 考慮過的方案 (Options Considered)

### 記憶儲存位置（跨專案通用記憶）

1. **方案 A — 全由各 agent 的全域私有 auto-memory 承擔**：零新增檔案；但 Claude Code 的內建記憶是 per-project（`~/.claude/projects/<專案>/memory/`），無「跨專案通用」層，且不同 agent 各自為政。
2. **方案 B — 全部集中單一全域記憶檔**：最簡單；但不同專案的教訓混在一起互相污染，違反單一責任。
3. **方案 C — 通用全域 ＋ 專案分離的兩層記憶**（選定）：跨專案通用教訓放全域 `~/.claude/memory/`；專案特定教訓放該專案記憶層（OneShort 用 repo 內 `.agent/learning/`，其他專案用 Claude Code 內建 per-project 記憶）。由 `learn`／`evolve` 依「換個專案還成立嗎」分流。

### 全域串接機制

1. **方案 X — 編輯使用者全域 `~/.claude/CLAUDE.md` 加內容或 @import**：確定全域載入；但侵入使用者私人指令檔。
2. **方案 Y — 放 `~/.claude/rules/learning.md`，靠 rules 目錄自動載入**（選定）：已由實證確認 `~/.claude/rules/context7.md` 會被當「所有專案的全域指令」自動載入本 session，故新增規則檔同機制生效，**不需**改動使用者 CLAUDE.md。

### OneShort 既有專案版的處置

1. 完全回退，全部集中全域。
2. 兩套完整保留、各自獨立（冗餘）。
3. **保留為專案特化引用層**（選定）：保留 ADR 與 OneShort 專屬教訓；`.agent/rules/learning.md` 瘦身為「以全域為權威」的專案特化，通用內容不重複。

## 決策 (Decision)

採「全域機制層 ＋ OneShort 專案特化層」：

**全域層（`~/.claude/`，跨所有專案）**
- `~/.claude/rules/learning.md`：迴圈**權威定義**（五步、擷取觸發、分流、蒸餾／升級／修剪、格式、誠實與安全邊界）。經 rules 目錄自動載入。
- `~/.claude/memory/{MEMORY.md,inbox.md}`：跨專案通用記憶（上限 50 條）；由 learning.md §0 指示每個 session 開場讀取。
- `~/.claude/skills/{learn,evolve}`：全域操作程序，所有專案可用。

**OneShort 專案特化層**
- `.agent/rules/learning.md`：瘦身為七層在本 repo 的落點、記憶分流、串接點、專案層安全強化；**不重複**全域迴圈定義。
- `.agent/learning/{MEMORY.md,inbox.md}`：僅 OneShort 專屬教訓（通用條目已上移全域）。刻意用 repo 內記憶層而非 Claude Code per-project 記憶，因需跨 agent 共享且進版控。
- `.codex/skills/{learn,evolve}`：供 Codex 在專案內使用的精簡入口（Codex 讀不到 `~/.claude`）；`.claude/skills/` 不再放本地副本，Claude Code 用全域版。
- 串接：`CLAUDE.md` @import、`AGENTS.md`、`docs-router.md`、`core.md` §12。
- `.gitignore` 白名單：`!CLAUDE.md`、`!.agent/learning/`、`!.agent/learning/**`。

## 理由 (Rationale)

- **安全性**：進版控的記憶層（`.agent/learning/`）明定禁止寫入秘密，環境變數只記名稱；全域 `~/.claude/memory/` 雖不進版控同樣不記秘密值。此邊界寫進全域規則與各 skill。
- **維護性**：通用內容單點維護在全域，OneShort 引用不重複——直接回應使用者「避免重複維護」的要求；兩層記憶分流（通用 vs 專案）維持單一責任，避免跨專案污染。全域串接選 rules 自動載入而非改 CLAUDE.md，把對使用者私人檔的侵入降到零。
- **效能**：全域 always-load 檔 +1（learning.md，刻意精簡，細節下放 skills）；通用 MEMORY.md 每 session 讀一次但受 50 條上限約束，不爆 context。

## 被拒絕方案與原因 (Rejected Alternatives)

- 記憶方案 A（純 auto-memory）：無跨專案通用層、多 agent 各自為政。
- 記憶方案 B（單一全域檔）：跨專案教訓互相污染。
- 串接方案 X（改使用者 CLAUDE.md）：非必要地侵入私人指令檔（rules 自動載入已足夠）。
- OneShort 回退／雙套獨立：前者丟失專案特化與 ADR 脈絡，後者造成通用內容重複維護。
- 照文章原樣新建 `USER.md`＋每日日誌：與既有全域設定、git log／ADR 重複，徒增腐化面。
- 以 Claude Code hooks 為主要自動化機制：Codex／Gemini 無法受益，故擷取觸發改放 always-load 規則層。

## 影響 (Consequences)

- **所有專案**每個 session 多載入一份全域 always-load 規則（`~/.claude/rules/learning.md`），並在開場讀全域 MEMORY.md。
- 全域 `~/.claude/`（記憶、規則、skills）不進任何 repo 版控、僅本機生效；跨機器需自行同步（未來可另立備份／同步方案）。
- OneShort：`.agent/rules/learning.md` 依賴全域檔為權威——fresh clone 到無全域設定的機器時，專案 learning.md 仍保有七層落點與分流摘要可獨立理解，但完整迴圈程序需該機器有全域層或另讀全域 skill。
- root repo 追蹤 `CLAUDE.md` 與 `.agent/learning/`；`.agent/learning/` 記憶變更以 `docs(learning): ...`／`chore(learning): ...` 提交。
- core.md §12 的反思產出從「只記在 PR/commit/plan」升級為「同時進入可累積的記憶迴圈」。

## Supersedes / Superseded by

無。（本 ADR 於同一未合併分支內從「純專案內」迭代為「全域＋專案分層」，非推翻既有已合併決策。）
