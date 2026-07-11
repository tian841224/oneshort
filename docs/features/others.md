# 其他模組 (Other Modules)

包含 OCR、Bug 回報與已移除模組的維護狀態。

---

## 1. OCR 影像辨識 (OCR Module)

- **業務功能**:
    - `POST /api/v2/ocr/parse-screenshot` 接收 PNG/JPEG/WEBP 截圖並回傳解析結果。
    - `POST /api/v2/ocr/presign` 在 storage 設定完成時提供上傳預簽 URL。
- **後端 (Backend)**:
    - **Domain**: `backend/internal/ocr/domain.go`.
    - **Handler**: `backend/internal/ocr/handler.go`.
    - **Scanner**: 目前以 dummy scanner / service boundary 保留替換空間。
- **維護性分析**:
    - 未來導入 Google Vision API 或 Tesseract 前，需保持圖片儲存、OCR 分析與 API handler 解耦。

---

## 2. Bug 回報 (Bug Report)

- **業務功能**:
    - `POST /api/v2/bug-reports` 為公開端點，目前不要求登入。
    - `GET /api/v2/bug-reports` 回傳最新 50 筆、所有狀態的公開摘要，依建立時間由新到舊排序；不得公開 `user_id`、`contact`、`description` 或 `developer_reply`。
    - `PATCH /api/v2/admin/bug-reports/{id}` 為管理員端點，用於更新 `status` 與 `developer_reply`。
    - Request 欄位為 `title`、`description`、選填 `contact`。
    - 建立回應以 `{ data: SubmittedBugReport }` 回傳新建資料，不包含 `user_id` 或 `developer_reply`。
    - `status` 可能值為 `open`、`in_progress`、`completed`。
- **後端 (Backend)**:
    - **Domain**: `backend/internal/bugreport/domain.go`.
    - **Handler**: `backend/internal/bugreport/handler.go`.
    - **Repository**: `backend/internal/bugreport/repository.go`.
- **前端 (Frontend)**:
    - **Component**: `frontend/src/components/bug/BugReportModal.tsx`.
    - **API**: `frontend/src/lib/api/bugReportApi.ts`.

---

## 3. 已移除模組與相關殘留設定

- `raid` 模組已從正式前後端流程移除；不要在新文件中描述為現行功能。
- `raid_boss_options` 仍保留，作為 `BOSS` 與 `GROUP` 隊伍的目標選項資料來源，不代表 Raid 模組仍存在（見 `docs/features/party.md` §1）。
- `guild` 模組已於 2026-04-28 重新導入，**為現行功能**，不適用本節「已移除」狀態；詳見 `docs/features/guild.md`。

---

## 4. 分析與維護性分析 (Analysis)

### 🔴 當前分析 (Current State)
- **OCR 非同步**: 辨識若改用外部服務，需評估改成「上傳回傳 JobID，完成後透過通知推送」。
- **Bug 回報資料量**: 若回報量增加，需要補管理端列表、分頁與狀態欄位。
