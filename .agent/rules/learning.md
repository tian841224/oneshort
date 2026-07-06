---
trigger: always_on
---

# 自我學習迴圈 (Self-Learning Loop)

本文件定義 OneShort 的 AI 自我學習流程：任務中擷取教訓 → 蒸餾成精煉記憶 → 升級為正式規則／技能／ADR → 定期修剪與驗證。架構參考〈AI Agent 7 層架構〉(<https://raymondhouch.com/lifehacker/digital-workflow/ai-agent-7-layer-architecture/>)，映射與取捨記錄於 [ADR-0012](../../docs/decisions/0012-self-learning-loop.md)。

## 1. 七層架構映射

| 層 | 名稱 | OneShort 對應 | 狀態 |
|---|------|--------------|------|
| 1 | 核心規則 | `CLAUDE.md`／`AGENTS.md` @import 串接 → `.agent/rules/` | 既有 |
| 2 | 技能 | `.claude/skills/`（canonical）＋ `.codex/skills/`（同步副本） | 既有 |
| 3 | 精煉記憶 | [MEMORY.md](../learning/MEMORY.md)（便利貼層，上限 50 條）＋ [inbox.md](../learning/inbox.md)（未蒸餾收件匣） | 本迴圈新增 |
| 4 | 使用者畫像 | 使用者全域設定（`~/.claude/CLAUDE.md`）與各 agent 全域記憶；專案層級的協作偏好差異記在 MEMORY.md「協作偏好」段 | 映射既有 |
| 5 | 對話歷史 | git log、ADR（`docs/decisions/`）、PR 描述、各 agent 的 session 紀錄 | 映射既有 |
| 6 | 生命週期自動化 | §3 擷取觸發（規則層，跨 agent 可攜）＋ `learn`／`evolve` skills；Claude Code hooks 為選配（§6） | 本迴圈新增 |
| 7 | 多平台門面 | AGENTS.md「各 Agent 讀取路徑」：Claude Code／Codex／Gemini | 既有 |

## 2. 迴圈總覽

```text
擷取 (Capture) → 蒸餾 (Distill) → 升級 (Promote) → 修剪 (Prune) → 驗證 (Verify) ─┐
   ▲                                                                            │
   └────────────────────────────────────────────────────────────────────────────┘
```

- **擷取**：任務中即時把教訓丟進 `inbox.md`，成本低、不打斷任務。
- **蒸餾**：`learn`／`evolve` skill 把 inbox 整理成 MEMORY.md 精煉條目（去重、概括）。
- **升級**：重複出現或結構性的教訓，升級成 rules／skills／ADR，成為永久行為。
- **修剪**：定期刪除過時、被證偽、已升級的條目，維持便利貼層精簡。
- **驗證**：檢查既有教訓是否真的阻止了重複錯誤；無效教訓必須改寫或升級，不得原樣留著。

## 3. 擷取觸發（always_on，所有 agent 適用）

任務進行中遇到下列任一情況，**必須在該任務結束前**把教訓寫入 [.agent/learning/inbox.md](../learning/inbox.md)（格式見 §5）：

1. 使用者糾正了你的做法、答案或假設。
2. [core.md §12 錯誤反思機制](core.md#12-錯誤反思機制) 被觸發，且根因是可概括的錯誤假設。
3. 發現實際行為與文件／規則的描述不符。
4. 同一 session 內第二次犯同類錯誤。
5. 使用者明說「記住」「記錄教訓」「下次注意」（此時改用 `learn` skill 完整處理）。

**例外**：教訓若屬方案取捨的設計決策，直接走 ADR（core.md §3.1）；inbox 只記一行並指回該 ADR，不重複內容。

## 4. 蒸餾／升級／修剪規則

### 4.1 蒸餾（inbox → MEMORY.md）

- 觸發：使用者執行 `learn`／`evolve` skill；或任務結束時 inbox 未處理條目 ≥5。
- 每條改寫為「可操作的一句話＋適用時機」，合併重複條目，保留來源與日期。
- MEMORY.md 上限 **50 條**；達上限時必須先修剪或升級，禁止無限成長。

### 4.2 升級（MEMORY.md → rules／skills／ADR）

| 教訓性質 | 去向 |
|---|---|
| 每個任務都該遵守的行為準則，或同類教訓重複發生 ≥2 次 | `.agent/rules/` 對應檔案（core／frontend／backend／style／本檔） |
| 多步驟可重複的程序（「如何做某件事」） | 新增或更新 skill：`.claude/skills/<name>/`，並同步複製到 `.codex/skills/<name>/` |
| 方案取捨、架構決策 | ADR：`docs/decisions/NNNN-*.md` ＋ 更新 [index.md](../../docs/decisions/index.md) |

升級後，MEMORY.md 原條目**刪除或改為一行指標**（指向新位置），避免雙重維護與內容漂移。

### 4.3 修剪

- `evolve` 時逐條驗證：條目引用的檔案／指令／行為是否仍存在（用讀檔工具實際確認，不憑印象）；過時或被證偽的條目直接刪除。
- 某教訓記錄後同類錯誤仍再度發生 → 該條目視為**無效**，必須升級為規則或 skill 並改寫，不得原樣保留。

## 5. 檔案格式

### 5.1 inbox.md 條目（append-only，蒸餾後移除）

```markdown
## 2026-07-07｜類型: 糾正｜來源: <session 主題 / commit / PR>
- 情境：一句話描述發生什麼。
- 教訓：錯誤假設是什麼、正確做法是什麼。
- 建議去向：MEMORY｜rule:core.md｜skill:<name>｜ADR
```

類型限定：`糾正`（使用者糾正）、`錯誤`（§12 反思）、`發現`（行為與文件不符）、`指示`（使用者要求記住）。

### 5.2 MEMORY.md 條目

```markdown
- **[M-NNN]** 教訓一句話。適用：什麼情況下要想起這條。（來源: <事件>, 記錄: YYYY-MM-DD）
```

編號流水遞增、不重用；分區歸類（協作偏好／環境與工具陷阱／流程教訓／專案事實）。

## 6. 週期回顧（`evolve` skill）

- 建議頻率：**每週一次**；或 inbox 未處理 ≥5 條、MEMORY.md 逼近上限時提前執行。
- 完整程序見 `evolve` skill；完成後更新 MEMORY.md 表頭的「上次蒸餾」「上次回顧」與條目數。
- Claude Code 使用者可另設排程或 hooks 提醒執行（例如每週五）；此為選配增強，規則層觸發（§3）不依賴任何特定 agent 的 hook 機制，Codex／Gemini 同樣適用。
- **無 skill 載入能力的 agent（如 Gemini）**：`learn`／`evolve` 只是操作捷徑；改為直接把本檔 §4／§5 的步驟與 `.codex/skills/{learn,evolve}/SKILL.md` 當一般文件讀取後手動執行即可，迴圈本身不依賴 skill 機制。

## 7. 誠實性與安全邊界

- 記憶條目是「當下觀察」：引用前必須驗證仍成立；不確定的觀察標註「待驗證」，禁止把未驗證推論寫成事實。
- `.agent/learning/` 會進版控：**禁止寫入任何秘密**（token、密碼、連線字串、個資）；環境變數只記名稱、不記值。
- 教訓與規則衝突時，以 `.agent/rules/` 與 ADR 為準，並在下次 `evolve` 時修正該條目。
