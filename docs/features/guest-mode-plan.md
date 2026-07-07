# OneShort 訪客快速使用 (Guest Mode) v1 規劃

## Implementation Status (2026-07-07 校正：ADR-0015 推翻部分 Locked Decisions)

> ⚠️ **本段以下的「Locked Decisions」表格，其互通性/聊天/`allow_guest_players` 相關條目已被 [ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md) 正式推翻**：訪客現在可以建立/申請一般即時公開隊伍、可以擔任隊長、可以雙向申請登入者的隊伍（反之亦然），v1 已納入訪客聊天，且 `allow_quick_login_players` 語意已擴張為同時涵蓋訪客。詳見下方「ADR-0015 後的現況」段落；本節以下（Implementation Status 2026-06-25 校正之後）保留作為 quick-guest 系統的歷史脈絡，不再是完整現況。

## ADR-0015 後的現況（2026-07-07）

在既有 quick-guest（quick party）系統之外，訪客現在**額外**可以參與「一般即時隊伍」（`internal/party` 的 `CreateParty`/`Apply` 家族，`scheduled_at IS NULL && guild_id IS NULL` 的 Redis-only 即時公開隊伍）：

| 能力 | 現況 |
|---|---|
| 訪客建立一般即時隊伍（含當隊長） | `POST /parties/guest`；強制 immediate/public/非 quick，見 ADR-0015 |
| 訪客申請一般即時隊伍（含申請登入者的隊伍） | `POST /parties/{id}/guest-applications` |
| 訪客隊長管理（審核/踢人/關團/閒置確認/設定） | `/parties/{id}/guest-*` 系列端點 |
| 訪客聊天 | v1 已納入（`usecase_lookup.go` guest 分支） |
| 登入後自動認領 | `POST /parties/guest-claim`，登入時前端自動呼叫 |
| `allow_quick_login_players` | 語意擴張為「允許未綁 Discord 的參與者（quick-login actor + 訪客）」，未新增欄位 |

完整設計、資料模型、被拒方案見 [ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md)。quick party（獨立系統，`is_quick=true`）行為不變，見下方 v1 規格與現況表。

## Implementation Status (2026-06-25 校正)

> ⚠️ 本段先前宣稱於 `feature/guest-mode-v1` 分支實作 v1——但該分支在 frontend / backend 兩個 repo（含 origin）**都不存在**，`internal/guest`、`guestProfileStore.ts` 等規格命名的檔案也從未進入 git 歷史。先前敘述視為**過期 / 未採用的設計提案**。

**實際狀態：本規格的 v1 能力已由既有「quick-party / quick-guest」系統實作並上線於 develop，但採用了與本文件不同的命名**（規格的 `Principal` / `internal/guest` / `guestProfileStore` / `useIdentity` 命名未被採用）。能力對應：

| 規格 v1 能力 | 實際實作（develop） |
|---|---|
| 未登入瀏覽公開即時隊伍 | `OptionalAuth` + party `GET /parties`、`/:id`（`backend/internal/party/handler.go`）|
| 未登入用訪客角色建即時 Redis 隊伍 | `quick_guest_token` cookie + `QuickPartyViewer` + `POST /parties/quick` + immediate Redis party；前端 `QuickCreateWizard`、`QuickGuestIdentityPrompt`、`frontend/src/lib/quickGuestIdentity.ts` |
| actor 申請 / 加入 guest-owned party | quick-join 流程（見 `docs/frontend-logic.md` §3.4A）|
| 訪客登入後 party 轉 actor-owned | `frontend/src/lib/quickPartySession.ts`（host/member/pending）+ 登入流程（遷移細節仍待逐項核對）|
| localStorage + cookie + Redis TTL、no Postgres PII | `quick_guest_token` + `quickPartySession`(localStorage) + Redis |

> **不應據此「全新實作」**，以免與既有 quick-guest 系統產生平行系統。若要推進 Phase 2，請以既有 quick-guest 命名為基準做 gap 分析。下方原始規格保留作為設計參考。

仍保留 v1 範圍限制：guest 不申請 actor-owned party、不開 guest websocket/chat/notifications、不新增匿名 Postgres 資料、不新增 `allow_guest_players`。

## Context

OneShort 現行正式身分模型已收斂到 `actor + current_character`。後端 JWT claims、middleware、party usecase、notification personal room、frontend `useAuth` 都以 actor/current character 作為登入與互動的基礎；舊 guest token、guest personal room、guest notification store 已不再是正式資料流。

因此 Guest Mode v1 不應重新打開完整 legacy guest 架構，而是先支援最低風險、最高價值的訪客試用流程：

1. 未登入使用者可以瀏覽公開即時隊伍。
2. 未登入使用者可以用臨時訪客角色建立即時 Redis 隊伍。
3. 已登入 actor 玩家可以申請或加入 guest-owned immediate party。
4. 訪客登入後，自己建立的 guest-owned Redis party 轉成 actor-owned immediate Redis party。
5. 訪客資料只保存在 localStorage、HTTP-only guest cookie、Redis TTL key；v1 不把匿名訪客 PII 寫入 Postgres。

設計原則：優先複用現有 actor party、Redis immediate party、Quick Login、Zustand persist、Modal、toast 與 auth middleware pattern；避免新增 legacy 欄位或重做一套平行 party 系統。

---

## V1 Scope

### In Scope

| 能力 | v1 決策 |
|------|---------|
| 訪客瀏覽 | public/optional identity 可讀公開即時 party list/detail |
| 訪客建隊 | 只允許 `scheduled_at = null`、非 guild、非 password 的 immediate party |
| 訪客資料 | localStorage 保存表單草稿，Redis 保存 guest session/character/party，guest cookie 保存簽章 session |
| Actor 加入訪客隊伍 | 已登入 actor 使用現有 current character 申請或加入 guest-owned party |
| 登入遷移 | guest-owned Redis party 改寫為 actor-owned immediate Redis party，清掉 guest snapshot |
| Postgres | 不保存匿名 guest_id、guest display name、guest character snapshot |

### Out Of Scope For V1

- ~~guest 申請 actor-owned party~~ **已由 [ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md) 推翻**：訪客現在可以申請一般即時隊伍，無論隊長是訪客或登入者。
- ~~guest websocket 訂閱、guest personal room、guest notifications~~ **已由 ADR-0015 推翻**：訪客的個人房通知已可送達（沿用 quick party 既有的 token-hash 導出 UUID 機制）。
- ~~guest chat membership 或 guest chat history~~ **已由 ADR-0015 推翻**：v1 已納入訪客聊天（不含歷史訊息持久化以外的既有聊天機制）。
- guest application migration；訪客登入後若曾申請其他隊伍，v1 要求重新以 actor 身分申請。**已由 ADR-0015 推翻**：登入時 `POST /parties/guest-claim` 會自動改寫待審申請的申請人身分，不需要重新申請。
- scheduled party、guild party、password party 的 guest 建立或加入。**password party 部分已由 ADR-0015 推翻**（訪客可申請有密碼保護的一般即時隊伍）；scheduled/guild party 仍維持排除。
- ~~新增 `allow_guest_players` DB 欄位；v1 保留現有 `allow_quick_login_players` 語意不變~~ **語意本身已由 ADR-0015 擴張**：`allow_quick_login_players` 現在同時涵蓋「未綁 Discord 的 actor」與「訪客」，但確實未新增新欄位（與本條「不新增欄位」的字面決定一致，只是語意範圍變了）。
- 跨裝置還原訪客資料、訪客頭像、訪客資料長期保存、TTL 延長 UI。（此條不受 ADR-0015 影響，仍為 Out of Scope）

---

## Locked Decisions

> 下表為 quick-guest 系統原始設計時的決定；標註「已推翻」的條目其現況見 [ADR-0015](../decisions/0015-guest-standard-immediate-party-interop.md)，此處保留原文供歷史對照。

| 項目 | 決定 | 現況 |
|------|------|------|
| 身分模型 | 新增 `Principal(kind=actor\|guest\|anonymous)` 作為 optional identity contract | 未採用此命名；實際落地為 `pkg/identity.Identity{Kind: actor\|discord\|guest}`（見上方 Implementation Status 2026-06-25 校正） |
| 儲存策略 | guest session/profile/party 放 Redis + localStorage，TTL 4h；不新增匿名 guest Postgres 寫入 | 仍成立，ADR-0015 未變動此點；quick-guest session TTL 實際為 24h（`quickGuestSessionTTL`），非本文件原訂的 4h |
| v1 互通性 | 只支援 actor 申請或加入 guest-owned party；guest 不能申請 actor-owned party | **已由 ADR-0015 推翻**：雙向皆可申請 |
| 訪客 party 限制 | 強制 immediate public party，`scheduled_at = null`，不支援 guild/password | **password 部分已由 ADR-0015 推翻**（訪客可申請/建立有密碼的一般即時隊伍）；immediate/public/非 guild 仍成立 |
| 訪客登入後 | guest-owned Redis party 改成 actor-owned immediate Redis party；沿用 immediate Redis party 生命週期 | 仍成立，並由 ADR-0015 新增了對應的一般即時隊伍認領流程（`POST /parties/guest-claim`） |
| Quick Login | 不改 `allow_quick_login_players` 行為，不把 guest 當 quick-login actor | **語意已由 ADR-0015 擴張**：`allow_quick_login_players` 現在也同時阻擋/放行訪客申請一般即時隊伍 |
| Realtime | v1 不改 notify hub subscriber model，不新增 guest websocket | 仍成立（未新增獨立的 guest websocket），但**訪客聊天已由 ADR-0015 納入**一般即時隊伍 |

---

## Architecture Overview

```
Browser
  localStorage: guestProfileStore
  Cookie: guest_token (HTTP-only, signed, TTL 4h)
      |
      v
Gin Backend
  OptionalPrincipal middleware
    - actor access token -> Principal{kind: actor}
    - guest cookie        -> Principal{kind: guest}
    - none                -> Principal{kind: anonymous}
  internal/guest
    - session / character / migrate
  internal/party
    - public list/detail
    - guest-owned immediate party
    - actor applies to guest-owned party
      |
      v
Redis
  guest session / character / party / owner index
  existing immediate party storage where possible

Postgres
  existing actor, character, scheduled/guild party data only
```

重要限制：`POST /guest/migrate` 必須同時讀到 actor access token 與 guest cookie。一般 optional principal 可以用 actor 優先，但 migrate endpoint 不能因 actor token 存在就遮蔽 guest session。

---

## Backend Changes

### 新增 package：`backend/internal/guest/`

| File | Purpose |
|------|---------|
| `domain.go` | `GuestSession`、`GuestCharacter`、migrate result、Redis key constants |
| `repository_redis.go` | guest session/character/owner index CRUD 與 TTL touch |
| `usecase.go` | CreateSession、SetCharacter、GetCurrentGuest、MigrateOwnedParties |
| `handler.go` | HTTP handlers |
| `token.go` | guest token sign/verify，使用現有 auth token 簽章設定與安全 cookie pattern |

### Public Guest Routes

```
POST   /api/v1/guest/session
POST   /api/v1/guest/character
GET    /api/v1/guest/me
DELETE /api/v1/guest/session
POST   /api/v1/guest/migrate
```

行為：

- `/guest/session` 建立 `guest_id`，簽 HTTP-only cookie，初始化 Redis session TTL。
- `/guest/character` 驗 guest cookie，保存 `{display_name, job_class_id, level}` 到 Redis。
- `/guest/me` 只回目前 guest session/character；沒有有效 cookie 時回 anonymous-safe response，不觸發全域 auth error。
- `/guest/session` DELETE 清 cookie 與 guest session/profile。
- `/guest/migrate` 需要 actor token + guest cookie；取得 actor current character 後才能執行遷移。

### Middleware

在 `backend/pkg/middleware/auth.go` 新增 optional principal 路徑，不改現有嚴格 `Auth()`。

```go
type PrincipalKind string

const (
    PrincipalActor     PrincipalKind = "actor"
    PrincipalGuest     PrincipalKind = "guest"
    PrincipalAnonymous PrincipalKind = "anonymous"
)

type Principal struct {
    Kind        PrincipalKind
    ActorID     *uuid.UUID
    CharacterID *uuid.UUID
    GuestID     *uuid.UUID
}
```

規則：

- 一般 optional endpoint：actor token 成功時回 actor，否則嘗試 guest cookie，否則 anonymous。
- migrate endpoint：顯式解析 actor token 與 guest cookie，兩者都必須有效。
- 嚴格 actor-only route 繼續使用現有 `Auth()`，避免影響通知、聊天室、個人頁、guild、scheduled party 等敏感面。

### Party v1 行為

#### `GET /api/v1/parties`

- 改成 public/optional principal 可讀公開 party list。
- 回傳既有 actor party 與 guest-owned Redis party 的統一 response。
- guest-owned party 加上 `is_guest_owned: true`、`leader_kind: "guest"`、guest leader display snapshot。
- 不把 technical guest id 暴露到前端列表。

#### `GET /api/v1/parties/{id}`

- 先沿用現有 party read path；找不到時查 guest-owned Redis party。
- 回傳相同 party detail shape，補 `is_guest_owned`、`leader_kind`。
- guest-owned party 不提供 chat history、notification subscription、guild metadata。

#### `POST /api/v1/parties`

- actor principal：走原 create party usecase，不改 existing behavior。
- guest principal：強制 guest character 已存在，且 payload 必須符合：
  - `scheduled_at = null`
  - `guild_id = null`
  - 不設定 password
  - public immediate party
- guest 傳 scheduled/guild/password 欄位時回 422，錯誤訊息明確指出「訪客僅能建立即時公開隊伍」。
- guest-owned party 寫 Redis，TTL 4h，加入 `guest:owner:{guest_id}` index。

#### `POST /api/v1/parties/{id}/applications`

- party 是 actor-owned 且 applicant 是 guest：v1 回 403 business error，提示登入後再申請。
- party 是 guest-owned 且 applicant 是 actor：允許，使用 actor current character snapshot 寫入 Redis application 或既有 Redis immediate artifact。
- party 是 guest-owned 且 applicant 是 guest：v1 不支援，避免 guest leader/review/chat/membership 模型在第一版擴散。
- actor-owned party + actor applicant：原行為不變。

#### Review / Auto Accept

- guest-owned party v1 建議採 auto-accept actor applicant，避免建立 guest leader 審核後台與 guest notification。
- 若保留手動審核 UI，必須仍然只處理 guest-owned party 中的 actor application，且不新增 guest websocket/notification。
- actor-owned party 的 review 行為不變。

### Redis Keys

| Key | Type | Purpose |
|-----|------|---------|
| `guest:session:{guest_id}` | Hash | created_at, last_active_at |
| `guest:character:{guest_id}` | JSON | display_name, job_class_id, level |
| `guest:party:{party_id}` | JSON | guest-owned immediate party snapshot |
| `guest:party:index` | ZSET | public list lookup, score=created_at_unix |
| `guest:owner:{guest_id}` | Set | guest-owned party ids for migration |
| `guest:application:{party_id}` | List/Hash | actor applications to guest-owned party |

每次有效 guest API 呼叫 touch session/character/owned party TTL。不要新增 `guest:slot_fill` 或 guest 對 actor party 的 side index，因為 guest apply actor-owned party 不在 v1。

### Login Migration

`POST /api/v1/guest/migrate`

```
Input:
  - Authorization actor access token
  - guest_token cookie

Flow:
  1. 驗 actor token，取得 actor id 與 current character id。
  2. 驗 guest cookie，取得 guest_id。
  3. 讀 guest:owner:{guest_id}。
  4. 對每個 guest-owned Redis party：
       - leader_kind = "actor"
       - leader_user_id = actor.id
       - leader_character_id = actor.current_character_id
       - 清除 guest leader snapshot / guest owner marker
       - TTL 改成現行 immediate Redis party 的標準 TTL
  5. 刪除 guest:character:{guest_id}、guest:session:{guest_id}、guest:owner:{guest_id}。
  6. 清 guest cookie。
  7. 回傳 migrated_party_ids。
```

注意：

- 如果 actor 沒有 current character，migrate 回 409，前端要求先選擇或建立角色。
- guest applications 不遷移。
- migrated party 保持 Redis immediate party，不轉成 Postgres scheduled/guild party。

---

## Frontend Changes

### 新增 store：`frontend/src/store/guestProfileStore.ts`

使用 Zustand persist 與 localStorage：

```ts
interface GuestProfileState {
  character: {
    display_name: string;
    job_class_id: number;
    level: number;
  } | null;
  hasSession: boolean;
  setCharacter(character): void;
  setHasSession(hasSession: boolean): void;
  clearAll(): void;
}
```

persist key：`oneshort-guest-profile`。

### 新增 hook：`frontend/src/hooks/useIdentity.ts`

```ts
type Identity =
  | { kind: "actor"; actor: Actor; character: CurrentCharacter }
  | { kind: "guest"; guestCharacter: GuestCharacter }
  | { kind: "anonymous" };
```

用途：

- 新 guest flow 使用 `useIdentity()`。
- 現有 `useAuth()` 不大規模改名或替換，避免 actor-only 頁面回歸風險。
- actor-only page 繼續以 `useAuth().isAuthenticated` guard。

### 新增元件：`GuestEnrollDialog`

功能：

- 輸入 display name、job class、level。
- 驗證沿用角色名稱/等級限制與 job class query。
- 提交時先確保 `/guest/session` 成功，再呼叫 `/guest/character`，最後寫入 guestProfileStore。
- 用於「建立隊伍」與「訪客資料缺失時」的入口。

### 建立隊伍頁

- anonymous 點建立隊伍時先打開 `GuestEnrollDialog`。
- guest 完成資料後可進入 create party flow。
- guest 模式鎖定「現在」/ immediate，排程、guild、password options 隱藏或 disabled。
- guest submit payload 不帶 actor-only 欄位，不帶 `allow_guest_players`。
- actor 模式原行為不變。

### Party List / Party Detail

- 未登入可讀 public party list/detail。
- `PartyCard` 顯示 guest-owned badge，但不顯示 guest UUID 或 technical status。
- actor 對 guest-owned party 可申請/加入。
- guest 對 actor-owned party 點申請時，顯示登入提示，不送出申請 API。
- guest-owned party 不顯示聊天室入口。

### Login Integration

登入成功後：

1. 如果 `guestProfileStore.hasSession === true`，呼叫 `/guest/migrate`。
2. migrate 成功後清 localStorage store 與 cookie。
3. 用 `migrated_party_ids` 顯示簡短 toast。
4. 若 migrate 回 409，保留 guest store 並提示先選擇角色，不清資料。
5. 若 guest session 已過期，清 store 並繼續正常登入。

### Hydration

App boot 時：

- actor 未登入時呼叫 `/guest/me` 探測 guest cookie。
- `/guest/me` 不可觸發 global 401 toast 或 redirect。
- 多分頁同步使用 Zustand persist/localStorage storage event；任一分頁清除 guest store 後其他分頁也要更新。

---

## Critical Files To Modify Later

### Backend

- `backend/internal/guest/` 新 package
- `backend/pkg/middleware/auth.go` optional principal helpers
- `backend/internal/party/handler.go` public/optional route split
- `backend/internal/party/handler_party.go` guest create/list/detail flow
- `backend/internal/party/handler_application.go` actor applies to guest-owned flow
- `backend/internal/party/domain.go` response flags and principal-aware input types
- existing Redis party repository paths where possible, plus guest-specific owner/session repository
- `backend/cmd/server/main.go` guest route registration

### Frontend

- `frontend/src/store/guestProfileStore.ts`
- `frontend/src/hooks/useIdentity.ts`
- `frontend/src/components/guest/GuestEnrollDialog.tsx`
- create party page model and component
- party list/detail components that render apply actions and guest-owned badges
- auth login success flow for migrate
- API clients/types for `/guest/*` and guest-owned party response fields

---

## Implementation Order

1. Backend guest session foundation: Redis repo, guest token, `/guest/session`, `/guest/character`, `/guest/me`, `/guest/session` DELETE.
2. Optional principal middleware and tests; keep strict `Auth()` unchanged.
3. Public party list/detail read path for anonymous/guest, including guest-owned Redis party serialization.
4. Guest create immediate party with Redis TTL and owner index.
5. Actor applies to guest-owned party; keep guest applies actor-owned party explicitly forbidden.
6. Guest migrate endpoint, including actor current-character validation and guest cleanup.
7. Frontend guest store, `/guest/me` hydration, `useIdentity()`.
8. `GuestEnrollDialog` and guest create party path with immediate-only UI.
9. Party list/detail guest-owned badge and actor apply path.
10. Login success migration and cleanup.
11. E2E/manual verification and PRD/task checklist update if this plan is split into tracked tasks.

---

## Verification Plan

### Backend Unit Tests

- Optional principal returns actor, guest, or anonymous correctly.
- Migrate parser can validate actor token and guest cookie at the same time.
- Guest create rejects scheduled/guild/password party payload.
- Guest session and guest character TTL touch behavior.
- Guest apply actor-owned party returns business 403.
- Actor apply guest-owned party writes Redis application artifact.

### Backend Integration Tests

- Anonymous/guest can read public party list/detail without actor auth.
- Guest creates immediate party and no new anonymous guest data appears in Postgres.
- Actor sees guest-owned party and applies with current character.
- Guest login migrates owned party to actor-owned immediate Redis party and clears guest Redis keys.
- Existing actor create/apply/review, quick-login restriction, guild party, scheduled party behavior remains unchanged.

### Frontend Tests

- `useIdentity()` covers actor, guest, anonymous.
- `GuestEnrollDialog` validation uses existing character constraints and job class options.
- Anonymous create flow opens dialog before submit.
- Guest create flow locks immediate mode and hides/disables out-of-scope options.
- Guest trying to apply actor-owned party gets login prompt without sending application request.
- Login success calls migrate when guest session exists and clears store only after success or known-expired guest session.

### Manual E2E

1. Open app in private browser, confirm party list/detail can load without login.
2. Click create party, fill guest profile, create immediate public party.
3. Verify Redis has guest session/profile/party/owner keys with TTL.
4. Verify Postgres has no anonymous guest profile or guest-owned party row.
5. In another browser logged in as actor, find the guest-owned party and apply/join.
6. Confirm party detail shows actor applicant/member without exposing guest UUID.
7. In guest browser, log in and confirm migration changes party leader to actor/current character.
8. Confirm localStorage guest profile and guest Redis session/profile keys are cleared.

### Document Review Checklist

- v1 不再承諾 full interop。
- v1 不新增 `allow_guest_players`。
- v1 不改 notify hub 或 guest websocket。
- v1 不遷移 guest applications。
- implementation order 可以直接拆成 backend/frontend 開發任務。

---

## Phase 2 Candidates

只有在 v1 驗證後，才重新評估：

- guest 申請 actor-owned party。
- guest chat membership。
- guest websocket/personal room。
- guest notifications。
- actor party 是否需要正式的 anonymous-player admission flag。
- guest activity lock、slot lock、kick/leave、party close 的完整資料模型。
