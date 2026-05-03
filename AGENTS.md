# OneShort - Agent Entry Point

所有開發規範收納於 `.agent/rules/`，以 `trigger` 自動載入。

## 規則載入

| 規則 | 觸發 | 內容 |
|------|------|------|
| [core.md](.agent/rules/core.md) | always_on | 邊界、Git Flow、架構原則、反思機制 |
| [docs-router.md](.agent/rules/docs-router.md) | always_on | 關鍵文件索引 |
| [backend.md](.agent/rules/backend.md) | `backend/**/*` | 後端架構、驗證、完成條件 |
| [frontend.md](.agent/rules/frontend.md) | `frontend/**/*` | 前端技術棧、驗證、完成條件 |

## 開發守則

- **先讀規則再動手**：所有開發行為必須符合 `.agent/rules/` 下的定義。
- **同步更新文件**：程式碼變更與對應文件更新必須在同一任務內完成。
