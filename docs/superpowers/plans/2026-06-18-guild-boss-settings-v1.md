# Guild Boss Settings V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓公會 BOSS 設定面板對新公會有實際功能，並限制非幹部只能看到「我的偏好」sub-tab。

**Architecture:** 純前端修改，3 個元件變更。後端 API（`/guilds/:id/boss-configs`、`/guilds/:id/me/preferences`）已完整實作。問題出在前端：(1) 新公會的 boss configs 為空，BossConfigsPanel 顯示空白；(2) MatchSection 對非幹部多顯示了「配對紀錄」tab；(3) MyPreferencesPanel 顯示所有 BOSS（含未啟用）。

**Tech Stack:** Next.js (App Router), React, React Query, TypeScript

**前置作業：** 修改 `frontend/` 前，請確認採 BRANCH 或 WORKTREE 模式（詢問使用者）。

---

## File Map

| 路徑 | 改動類型 | 說明 |
|------|----------|------|
| `frontend/src/app/guilds/[id]/_components/sections/BossConfigsPanel.tsx` | 修改 | 新公會空設定時，從 filterOptions 全部 BOSS 建立預設 draft（disabled=true）供幹部啟用設定 |
| `frontend/src/app/guilds/[id]/_components/sections/MatchSection.tsx` | 修改 | 非幹部只顯示 "prefs" tab（移除 "history"） |
| `frontend/src/app/guilds/[id]/_components/sections/MyPreferencesPanel.tsx` | 修改 | BOSS 選擇區只顯示 `enabled=true` 的 BOSS，並加入空狀態提示 |

---

## Task 1: 修改 MatchSection — 非幹部只顯示「我的偏好」

**Files:**
- Modify: `frontend/src/app/guilds/[id]/_components/sections/MatchSection.tsx:38`

- [ ] **Step 1: 修改 tab 過濾邏輯**

  在 `MatchSection.tsx` 第 38 行，將：
  ```tsx
  {MATCH_SUBTABS.filter((t) => isOfficer || t.id === "prefs" || t.id === "history").map((t) => (
  ```
  改為：
  ```tsx
  {MATCH_SUBTABS.filter((t) => isOfficer || t.id === "prefs").map((t) => (
  ```

- [ ] **Step 2: 驗證初始 subtab 邏輯不受影響**

  確認第 33 行的 `useState` 初始值仍正確：
  ```tsx
  const [subtab, setSubtab] = useState<MatchSubtabId>(isOfficer ? "run" : "prefs");
  ```
  非幹部初始為 "prefs"，符合需求，不需修改。

- [ ] **Step 3: Commit**
  ```bash
  git add frontend/src/app/guilds/[id]/_components/sections/MatchSection.tsx
  git commit -m "feat(guild): restrict match subtabs to prefs-only for non-officers"
  ```

---

## Task 2: 修改 BossConfigsPanel — 新公會空設定時預填所有 BOSS

**Files:**
- Modify: `frontend/src/app/guilds/[id]/_components/sections/BossConfigsPanel.tsx:118-169`

- [ ] **Step 1: 在現有 state 同步邏輯後，加入 filterOptions 空值 seeding**

  在 BossConfigsPanel 函式內，現有的 state 同步邏輯後（第 128 行之後），加入：

  ```tsx
  // When no backend configs exist, seed from all available bosses with disabled defaults
  if (!isLoading && initialConfigs.length === 0 && configs.length === 0 && bossOptions.length > 0) {
    setConfigs(
      bossOptions.map((b) => ({
        guild_id: guildId,
        boss_id: b.id,
        max_members: 4,
        min_level: 0,
        job_slots: [],
        enabled: false,
        updated_at: "",
      }))
    );
  }
  ```

  注意：這段放在現有的 `if (initialConfigs.length > 0 && configs.length === 0)` 之後，兩個條件互斥（一個是 `> 0`，一個是 `=== 0`），不會衝突。

- [ ] **Step 2: 確認 displayConfigs 邏輯不需修改**

  現有的 `const displayConfigs = configs.length > 0 ? configs : initialConfigs;` 已正確處理，seeding 後 `configs` 非空，`displayConfigs` 會顯示 seeded 資料，不需額外修改。

- [ ] **Step 3: 確認儲存邏輯不需修改**

  `save()` 函式直接從 `configs` 建立 payload，seeded 資料在儲存時也能正常 PUT 到後端（全部 disabled，幹部勾選啟用後再儲存），不需修改。

- [ ] **Step 4: Commit**
  ```bash
  git add frontend/src/app/guilds/[id]/_components/sections/BossConfigsPanel.tsx
  git commit -m "feat(guild): seed boss configs panel from all available bosses when guild has no configs"
  ```

---

## Task 3: 修改 MyPreferencesPanel — 只顯示啟用的 BOSS，並加入空狀態

**Files:**
- Modify: `frontend/src/app/guilds/[id]/_components/sections/MyPreferencesPanel.tsx:362-387`

- [ ] **Step 1: 計算 enabledBosses 並替換 BOSS 列表渲染**

  在 `return` 之前（約第 296 行之前），加入：
  ```tsx
  const enabledBosses = bossConfigs.filter((b) => b.enabled);
  ```

  然後將 BOSS 順位區塊（約第 362-387 行）的：
  ```tsx
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    {bossConfigs.map((b) => {
  ```
  改為：
  ```tsx
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
    {enabledBosses.length === 0 ? (
      <div style={{ padding: "12px 14px", fontSize: 12, color: "var(--os-text-muted)", background: "var(--os-surface-cream)", border: "1px dashed var(--os-border-soft)", borderRadius: "var(--os-radius-sm)", width: "100%" }}>
        公會尚未啟用任何 BOSS，請幹部至「BOSS 設定」啟用後即可選擇偏好。
      </div>
    ) : enabledBosses.map((b) => {
  ```

  在對應的 `})}` 閉合括號後加上 `}`（關閉三元表達式）：
  ```tsx
        </button>
      );
    })}
  </div>
  ```
  改為：
  ```tsx
        </button>
      );
    })}
  </div>
  ```
  注意：原本的 `bossConfigs.map(...)` 改為 `enabledBosses.map(...)`，閉合結構會多一個 `}` 用來結束三元表達式。

- [ ] **Step 2: Commit**
  ```bash
  git add frontend/src/app/guilds/[id]/_components/sections/MyPreferencesPanel.tsx
  git commit -m "feat(guild): show only enabled bosses in preferences panel with empty state hint"
  ```

---

## 驗收條件

- [ ] 幹部開啟「BOSS 設定」tab → 看到所有可用 BOSS（預設全部 disabled）
- [ ] 幹部啟用部分 BOSS 並儲存 → PUT 成功，下次進入仍顯示已儲存設定
- [ ] 成員開啟「BOSS 配對」tab → 只看到「我的偏好」sub-tab，看不到其他 tab
- [ ] 成員在「我的偏好」→ BOSS 順位區塊：若幹部未啟用任何 BOSS 顯示提示訊息；若有啟用 BOSS 則正常顯示可選擇
