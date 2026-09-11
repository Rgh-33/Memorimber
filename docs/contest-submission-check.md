# コンテスト提出前の実装・確認記録

作業ブランチは `feature/issue-110-UI-adjust`。mainのmerge/rebase/cherry-pick、Issue #118、既存migrationの変更はしていません。

## 実装

| 項目 | 変更内容 |
| --- | --- |
| フォームズーム | 原因となる16px未満の入力文字を、幅767px以下またはcoarse pointerで共通CSSにより16px以上に保証。input/textarea/selectを対象に投稿・編集・設定などへ適用。viewportはwidthとinitial-scaleのみでpinch zoomを制限しない。 |
| スクロール | 投稿処理開始前・成功後・編集保存時にeditableをblur。全体のsmooth scrollをautoへ変更し、投稿後は既存router.replaceのスクロール1回に任せる。アルバムの既存スクロール復元とBottomNavのfixedは維持。visualViewport補正や新たなscrollIntoViewは追加していない。 |
| クイズ画像 | 画像ごとのloading/loaded/errorを管理。URL変更時はkeyで状態初期化し、キャッシュ画像はcomplete/naturalWidthでも確認。方眼上の光をCSSで左上→右下に流し、reduced-motionでは停止。中央Grid3X3削除、既存blurと回答後revealを維持。エラーは小さなplaceholder。 |
| 自由タグ | 固定候補に入力・追加ボタンを追加。trim、空文字拒否、固定候補を含む重複排除、選択解除、Enterのsubmit防止、IME変換確定Enterの除外。選択値は既存tags配列に入り、保存成功時に入力もreset。タグ用DB変更なし。 |
| PWA | Next標準manifest、standalone、日本語、start_url `/`。既存ヘッダーのSproutを使った192/512px PNG。通知専用Service Workerにはpush/notificationclickのみ（fetch cacheなし）。 |
| 通知設定 | 設定 > その他に未設定/有効/拒否/非対応を表示。許可要求はボタンクリック時のみ。有効化でsubscribeと認証済みDB保存、無効化でDB削除と端末unsubscribe。拒否時の再promptなし。 |
| 通知候補 | 実TreeのbuildPersistedTreeItemsを再利用した収穫候補と、memory_dateの1〜3年前±7日。両方あればユーザーとJST日付により種別を交互に選択。写真も決定的に選択。候補なしの日は送らない。本文にcaption/画像URLなし。 |
| Previewテスト | ON時だけボタン表示。保存済みの実memoryとpreview Tree.itemsを同じ候補選択関数へ渡し、SW.showNotification。VAPID・PushSubscription・Cron・日次履歴を使わない。サンプル写真を過去写真候補にしない。 |
| 重複防止 | user_id+JST日付を送信前に一意確保。retry/並行実行でも同日の再送を防止。複数端末には同じ種類。404/410だけsubscriptionを削除し、一時エラーは残す。 |
| ログアウト | ローカル解除に加えて、認証済みユーザーの全subscriptionをサーバーで削除。削除失敗は再試行表示。Auth削除はFK cascade。 |

外部Push送信とDBを一つのトランザクションにはできないため、重複禁止を優先するat-most-once送信試行です。タイムアウトやworker停止の際は、その日の通知が届かないことがあります。sent_atはPushサービス受付時刻で、OS表示の証明ではありません。

## DB・環境・Cron

- 新規migration：`supabase/migrations/20260911000000_memory_push_notifications.sql` 1本。作成前の最大versionは `20260907030000`、重複なし。
- `push_subscriptions`：endpoint一意、user_id、暗号鍵、作成・更新時刻。RLSで本人だけselect/insert/update/delete。Auth user削除でcascade。
- `memory_notification_deliveries`：user_id、JST日付、種別、候補ID、claimed_at、sent_at、status。日次複合主キー。通常ブラウザには権限なし。
- 新規env：`NEXT_PUBLIC_VAPID_PUBLIC_KEY`、`VAPID_PRIVATE_KEY`、`VAPID_SUBJECT`。実値はコミットしていません。
- VAPID生成：管理者が `npx web-push generate-vapid-keys` を実行。秘密鍵を安全に保管し、Vercel環境へ登録後に再デプロイ。SUBJECTは連絡先mailtoまたはHTTPS URL。
- Cron：`/api/cron/memory-reminders`、`0 11 * * *`（20:00 JST頃）。既存cleanup `0 18 * * *` を維持。CRON_SECRETのBearer認証。
- 今回追加したSecret使用箇所：通知Cron内の既存admin client（SUPABASE_SECRET_KEY）、Web Push送信のVAPID_PRIVATE_KEY。subscription APIは鍵設定の有無だけをサーバー内で確認。
- 投稿・木・アルバム・クイズ・共有・プロフィール・subscription登録は公開キー＋本人認証。これらにSecret依存を追加していません。
- クリック先は相対pathかつsame-originのみ。既存windowを移動・focusし、なければopenWindow。Push endpointも主要ブラウザの配信サービスHTTPSに制限。

## 確認結果と未確認範囲

- checkpoint `8b4f3bf`：255テスト、lint、build、diff --check成功。
- 最終自動テスト：`npm test` 274件成功、失敗0。候補境界、うるう日、同日retry/並行claim、他人のmemory除外、失効endpoint、部分失敗、subscribe/unsubscribe、拒否、保存失敗時解除、Preview、same-originを含む。
- `npm run lint`：成功。独立typecheckスクリプトはなく、buildの型チェックを使用。
- `npm run build`：最終成功（型チェック・本番生成を含む）。削除済みfixtureの生成型参照を除去して再実行済み。検証専用routeは含まれません。
- `git diff --check`：成功。
- ブラウザ確認：390px幅の投稿フォーム全入力16px、ズーム禁止metaなし、fixedナビ、自由タグtrim/空文字/重複/選択解除/Enter非送信。クイズ主画像・3写真選択肢のloading→loaded→reveal、errorでloader終了、サイズ維持、reduced-motion停止。Manifest・SW登録・未認証Cron401・通知設定UIを確認。
- ブラウザ検証はローカル・DB未接続の画面と検証用fixtureで実施。fixtureは除去済み。本番DBへの投稿や実配信成功は主張しません。
- **DB未適用**：migration push/reset/repair/applyは未実行。RLSの実DB検証は未実施。
- **Vercel env登録未実施**：本番の登録内容・Cron実配信は未確認。
- **iPhone未確認**：実機Safariのキーボード挙動、ホーム画面インストール、OS通知表示、バックグラウンド受信は未確認。Android実機も未確認。

管理者の残作業：migration適用 → VAPID生成 → Vercel env登録（既存SUPABASE_SECRET_KEY/CRON_SECRETも確認）→ 再デプロイ → PWA install → notification permission。

最短のiPhone確認：投稿画面で一言・日付入力 → 自由タグEnter追加 → 投稿してホームと下部ナビ → pinch zoom → slow networkでクイズ → Preview ON・日付変更・通知テスト → ホーム画面PWA起動・通知許可 → 通知解除・ログアウト。詳しいセットアップはREADMEのPWA節を参照してください。

## 変更ファイル一覧（ユーザーの既存変更を除く）

| 区分 | ファイル |
| --- | --- |
| フォーム・画像 | app/globals.css、app/quiz.css、components/memory-form.tsx、components/memory-detail-actions.tsx、components/quiz-question-card.tsx、lib/blur-active-editable.ts |
| PWA・UI | app/layout.tsx、app/manifest.ts、app/konoha.css、app/settings/[section]/page.tsx、components/memory-notification-settings.tsx、components/preview-notification-button.tsx、components/pwa-registration.tsx、components/tree-preview-controls.tsx |
| 配信・設定 | lib/memory-reminders.ts、lib/memory-reminder-runner.ts、lib/push-client.ts、lib/push-subscription.ts、app/api/push-subscriptions/route.ts、app/api/cron/memory-reminders/route.ts |
| ログアウト | app/auth/actions.ts、components/session-boundary.tsx |
| 配信基盤 | public/sw.js、public/pwa/icon-192.png、public/pwa/icon-512.png、scripts/generate-pwa-icons.mjs、middleware.ts、next.config.mjs、vercel.json |
| DB | supabase/migrations/20260911000000_memory_push_notifications.sql |
| テスト | tests/memory-reminders.test.mjs、tests/push-client.test.mjs、tests/account-deletion.test.mjs、tests/shared-group-ui.test.mjs、tests/tree-preview-controls.test.mjs |
| 依存・説明 | package.json、package-lock.json、.env.example、README.md、docs/contest-submission-check.md |

supabase/.temp/cli-latest と UIイメージ/ の既存変更はコミット対象外です。
