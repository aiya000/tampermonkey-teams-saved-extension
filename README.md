# Teams Saved Extensions - Slack-style "Done" and "Archive"

Adds Slack-style "Completed" and "Archived" tabs to the "Saved" section in Microsoft Teams. You can organize items saved in "Saved" by categorizing them into "Completed" or "Archived," or by deleting them. Data is stored in localStorage.

## 機能

- **保存中タブ** — Teams ネイティブの保存済みリストを表示。各メッセージに「完了にする」「アーカイブにする」ボタンを追加
- **完了タブ** — 完了にしたメッセージの一覧
- **アーカイブタブ** — アーカイブにしたメッセージの一覧
- **エクスポート / インポート** — データを JSON ファイルで保存・復元

データは `localStorage` に保存されます（クラウド同期なし）。

## インストール

1. ブラウザに [Tampermonkey](https://www.tampermonkey.net/) をインストール
2. [teams-saved-extension.user.js](https://raw.githubusercontent.com/aiya000/tampermonkey-teams-saved-extension/refs/heads/main/teams-saved-extension.user.js をTampermonkeyにインストール

## 対応 URL

- `https://teams.microsoft.com/*`
- `https://teams.live.com/*`
- `https://teams.cloud.microsoft/*`

## 開発

```sh
bun install

# 型チェック
bun run typecheck

# Lint チェック
bun run lint

# 自動修正
bun run fix
```

## ライセンス

MIT
