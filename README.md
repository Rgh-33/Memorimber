# メモリンバー（Memorimber）

> **何もなかった、なんてことはない。**

Memorimber は、高校生活の何気ない日常を「写真1枚＋一言」で残し、思い出の木・クイズ・アルバム・共有を通して、あとから自分の時間を思い出すためのスマートフォン向けWebアプリです。

サービス名は **Memory / Memories** と **Remember** を組み合わせています。

毎日日記を書くことや、大量の写真を後から整理することを前提にせず、「今日は残しておきたい」と思った日に短時間で記録できることを大切にしています。

## 解決したい課題

Memorimber が対象にしているのは、「思い出がない」ことではなく、**すでにある出来事を思い出すきっかけが少ないこと**です。

学校生活では、文化祭や修学旅行のような大きな出来事だけでなく、放課後の教室、帰り道、友達との会話、コンビニへ寄ったことなど、小さな出来事も積み重なっています。しかし、日々の忙しさや大量の写真の中に埋もれると、それらを「自分が過ごしてきた時間」として振り返る機会が少なくなります。

Memorimber は、記録を手軽に残し、その記録が木やクイズへつながることで、普通の日にも価値があったことに気付ける体験を目指しています。

## 体験の流れ

**残す → 育つ → 思い出す → 振り返る**

1. 写真と一言で出来事を残す
2. 記録が「思い出の木」に反映される
3. 育った木の実からクイズに挑戦する
4. 思い出した出来事へ自分の言葉を残す
5. 月ごとのアルバムやプロフィール、共有グループから振り返る

---

# 主な機能

## 思い出の投稿

写真1枚と短い一言を中心に、その日の出来事を保存します。

- 写真の選択とプレビュー
- 一言の入力
- 日付
- 人物
- タグ
- 投稿前の入力確認
- 画像サムネイル生成
- Supabase Database / Storage への永続保存
- 通信中断時の保存状態確認と後片付け

写真の元データは private Storage に保存し、一覧では可能な限りサムネイルを利用します。

対応画像形式は JPEG / PNG / WebP / HEIC / HEIF、最大20MBです。

## 思い出の木

ホーム画面では、その月に残した記録を「思い出の木」として表示します。

1つの思い出に対して1つの木の実の状態を持ち、投稿数や時間の経過に応じて成長・収穫可能状態へ変化します。

- 月ごとの木
- 記録数に応じた成長
- 木の実の成熟状態
- 木の実クイズ
- 収穫後の一言
- 金の木の実
- 過去の思い出を再び思い出す「復活」体験

実データの収穫状態や言葉は Supabase に保存し、表示用の一時状態と分離しています。

## 個人クイズ

保存した思い出から問題を生成し、写真・一言・日付などを手がかりに過去の出来事を思い出します。

- ランダムクイズ
- 写真 → 一言
- 一言 → 写真
- 月を当てる問題
- 複数形式を組み合わせたクイズ
- エンドレス形式
- 木の実収穫用クイズ
- 思い出復活用クイズ
- 回答履歴

問題、選択肢、正答、回答結果はDB側へ保存します。回答前に正答や元のStorageパスをブラウザへ渡さず、回答は保存済み問題に対してサーバー側で判定します。

## 月間アルバム

保存した思い出を月単位で振り返れます。

- 月ごとの写真一覧
- 月移動
- 個別の見た目設定
- フォント・レイアウト・色・模様
- 印刷 / PDF向け表示

一覧表示ではサムネイルを優先し、印刷や詳細表示など必要な場面だけ元画像を取得します。

## プロフィール・レベル

プロフィールには、ニックネーム、アバター、レベル、活動記録を表示します。

- ニックネーム編集
- プロフィール画像
- 最大20レベル
- 投稿数による進捗
- 収穫、クイズ、共有などの活動記録
- 到達済みレベルを保持する進捗管理

レベルや累計値はブラウザだけで確定せず、Supabase側の進捗・活動イベント・カウンターを正規データとして扱います。

レベル10以降には写真枚数だけでなく、収穫やクイズ、共有などの追加条件があります。条件が有効になった時点の活動値を baseline として保存し、過去の活動を新しい条件へ重複利用しない構造です。

## 共有グループ

Memorimber の共有は、公開URLではなく **登録済みアカウント同士のグループ**を基本としています。

1グループ = 1共有アルバムです。

- グループ作成
- 登録済みメールアドレスによる招待
- アプリ内通知から承認 / 辞退
- メンバー一覧
- メンバープロフィール
- グループ画像
- 共有写真の追加 / 解除
- メンバー退出
- オーナーによるメンバー除外
- グループ設定

共有された写真そのものを複製するのではなく、既存の思い出をグループから参照します。

同じ思い出を複数のグループへ共有できますが、同じグループ内では重複して共有しません。

オーナー移譲は現在実装しておらず、DB上の `role = 'owner'` を正式なオーナーとして扱います。

## 共有クイズ

同じ共有グループのメンバーで、共通の思い出を使った10問のクイズに参加できます。

- 待機ルーム
- 複数人参加
- 同じ問題を同じタイミングで出題
- ランダム設定
- カスタム出題設定
- 3 / 5 / 10秒の制限時間
- 写真 → 一言
- 一言 → 写真
- 月問題
- 投稿者の偏りを抑える設定
- 正答数と回答時間による順位

問題・参加者・制限時間・設定は開始時にDB側で固定し、クライアントが送るhidden inputなどを正規の設定値として信用しない構造です。

## 設定

設定画面では、見た目や音、木、アルバムなどを変更できます。

- ライト / ダーク表示
- テーマカラー
- BGM音量
- 効果音量
- 思い出の木の表示設定
- アルバムの見た目
- クイズ設定
- 投稿画面関連設定

一部は端末上の表示設定、一部はアカウントに紐づく設定として扱います。

---

# 技術構成

Memorimber は **Next.js を中心に構築したReact Webアプリ**です。

Next.js と React を別々のWebフレームワークとして併用しているわけではありません。**Next.js がReactをUI基盤として利用しています。**

## Webアプリ

- **Next.js 15（App Router）**
  - React 19 をUI基盤として使用
- TypeScript
- Tailwind CSS 3
- Lucide React

## バックエンド・データ

- **Supabase**
  - Authentication
  - PostgreSQL
  - Storage
  - Row Level Security（RLS）
  - PostgreSQL RPC / `SECURITY DEFINER`
  - Realtime

## サーバー処理

- Next.js Server Actions
- Next.js Route Handlers
- Sharp
- pdf-lib
- html-to-image

## ホスティング

- Vercel

## 開発環境

- Node.js 22.19.0
- npm
- ESLint

---

# データ保存とセキュリティ

## Supabaseを正規データとして利用

思い出、プロフィール、木の実、クイズ、共有、進捗などの永続データはSupabaseへ保存します。

React Context は画面間で使う表示用キャッシュとして利用し、永続データの正規保存先にはしません。

## 認証

Supabase Auth のメールアドレス・パスワード認証を利用しています。

- 新規登録
- ログイン
- ログアウト
- Cookieベースのセッション更新
- 未ログイン時のページ保護
- Auth callback

## RLS

データへのアクセス制御には Supabase PostgreSQL の Row Level Security を使用します。

- 自分の思い出は本人だけが編集・削除可能
- 共有写真は正式なグループメンバーだけ閲覧可能
- グループ設定の更新はオーナーだけ
- メンバープロフィールは同じグループの現メンバーだけ

通常のShare表示やクイズは、Publishable Key + ログインユーザーのJWT + RLS / RPCで動作する構成です。

## Storage

写真・プロフィール画像・グループ画像は非公開bucketに保存します。

ブラウザへ恒久的な公開URLを保存せず、必要に応じて署名URLや認証済みRoute Handlerを利用します。

共有一覧では、画面を開くたびに画像一覧と署名URLを作り直さないよう、ユーザー・グループ単位のメモリ内キャッシュと軽量version確認を利用しています。

- 15秒ごとの画像ポーリングは行わない
- Realtimeは変更通知として利用
- versionが変わらなければキャッシュを再利用
- 一覧はサムネイル優先
- 元画像は詳細・印刷など必要な時だけ取得

## Secret keyについて

`SUPABASE_SECRET_KEY` は通常の共有表示や個人クイズには不要です。

管理者権限が必要な処理だけで使用します。

現在、主に以下が対象です。

- `auth.users` からのAuthユーザー最終削除
- 全ユーザーを対象にした管理者cleanup / Cron

通常の共有解除などに伴う本人由来のcleanupは、認証済みユーザーとDB側の処理記録を使う方式を実装しています。

---

# 主な画面

| URL | 内容 |
| --- | --- |
| `/` | 思い出の木 |
| `/post` | 思い出の追加 |
| `/album` | 月間アルバム |
| `/quiz` | 個人クイズ |
| `/memory/[id]` | 思い出詳細 |
| `/profile` | プロフィール・レベル・活動記録 |
| `/shared-groups` | 共有グループ一覧・招待 |
| `/shared-groups/[groupId]` | 共有グループ詳細 |
| `/shared-groups/[groupId]/quiz/[sessionId]` | 共有クイズ |
| `/settings` | 設定 |
| `/account` | アカウント情報・削除処理 |
| `/login` | ログイン |
| `/signup` | 新規登録 |
| `/more` | Memorimberについて・その他 |

---

# 現在の実装状況

## 実装済み

- Supabase Authによる登録・ログイン・ログアウト
- プロフィールとアバター保存
- 思い出の投稿・編集・削除
- private Storageへの写真保存
- サムネイル生成
- 月間アルバム
- 思い出の木
- 木の実の成熟・収穫状態
- 個人クイズのDB保存とサーバー採点
- プロフィールレベル・活動記録
- 共有グループ
- メールアドレスによるアカウント招待
- アプリ内招待通知
- 共有写真
- グループ設定・グループ画像
- メンバープロフィール
- 共有クイズ
- 共有データのキャッシュ / Realtime invalidation
- 通常のShareをSecret keyに依存させない構成

## 管理処理として残しているもの

- Authユーザーそのものの最終削除
- 全ユーザー対象のcleanup worker / Cron

これらは通常ユーザー権限では実行せず、サーバー管理処理として分離しています。

## 継続して確認・調整しているもの

- RLS / Storage権限の実環境確認
- 複数端末での共有同期
- Safari / iPhoneを含むブラウザ確認
- cleanupの同時実行・再試行
- 通信量とEgressの継続確認

---

# セットアップ

## 1. 必要なもの

- Node.js 22.19.0
- npm
- Git
- Supabaseプロジェクト

## 2. インストール

```bash
npm install
```

## 3. 環境変数

`.env.local` を作成してください。

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# 旧形式のSupabaseプロジェクトを利用する場合のみ
# NEXT_PUBLIC_SUPABASE_ANON_KEY=

# 管理処理を利用する場合のみ
SUPABASE_SECRET_KEY=
CRON_SECRET=

# 任意
NEXT_PUBLIC_BGM_URL=
```

`SUPABASE_SECRET_KEY` と `CRON_SECRET` に `NEXT_PUBLIC_` を付けないでください。

Secret keyは通常のShare表示やクイズには不要です。

## 4. 開発サーバー

```bash
npm run dev
```

`http://localhost:3000` を開きます。

## 5. Lint / Build

```bash
npm run lint
npm run build
```

## 6. テスト

```bash
npm test
```

DB migrationやpgTAP、ブラウザ/E2Eの確認は用途に応じて個別に行います。

---

# Supabase migration

DB定義は `supabase/migrations/` で管理しています。

適用状況を確認してからpushしてください。

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
npx supabase db push --linked
```

**すでに適用済みのmigrationは後から編集せず、修正が必要な場合は新しいmigrationを追加する**方針です。

---

# プロジェクト構成

```text
Memorimber/
├─ app/                 # Next.js App Router・画面・Route Handlers
├─ components/          # UIコンポーネント
├─ lib/                 # 状態管理・ドメイン処理・Supabase接続
├─ public/              # 画像・音声などの静的ファイル
├─ supabase/
│  ├─ migrations/       # DB migration
│  └─ tests/            # DBテスト
├─ tests/               # Node.js / E2E関連テスト
├─ docs/                # 詳細な実装・引き継ぎ資料
├─ middleware.ts        # Supabaseセッション更新
├─ vercel.json          # Vercel Cron等
├─ package.json
└─ README.md
```

---

# 詳細ドキュメント

READMEは現在のサービス全体像を説明するための文書です。実装上の細かな判断、DB設計、過去Issueの確認手順は `docs/` に分離しています。

- [Supabase永続化・同期の実装資料](docs/supabase-persistence-implementation.md)
- [バックエンド実装引き継ぎ](docs/backend-implementation-handoff.md)
- [思い出保存の実装資料](docs/issue-34-save-memories.md)
- [思い出の木の実装資料](docs/issue-35-konohaan.md)
- [Secret keyを使わない通常Share cleanup](docs/authenticated-shared-cleanup.md)
- [共有メンバー取得の診断資料](docs/shared-members-diagnostics.md)

---

# 方針

Memorimberでは、単に写真を保存するだけではなく、**残した記録をもう一度思い出すきっかけへ変えること**を重視しています。

大きな行事だけでなく、何気ない一日も「自分が過ごした時間」として残せるサービスを目指しています。

## PWA・思い出の通知（コンテスト版）

通知専用 `/sw.js` と `app/manifest.ts` を使用します。画像キャッシュ・オフライン投稿はありません。通常機能は通知設定がなくても利用できます。

管理者が行うセットアップ（CodexではDB適用・env登録をしません）：

1. 新規migration `20260911000000_memory_push_notifications.sql` を確認して適用してください。既存migrationは変更不要です。subscriptionに所有者RLSとAuth削除cascade、日次履歴に `(user_id, notification_date)` の一意制約を追加します。履歴はブラウザ非公開です。
2. 手元で `npx web-push generate-vapid-keys` を実行し、鍵ペアを安全に保存してください。生成結果をコミットしないでください。
3. Vercelの対象環境に `NEXT_PUBLIC_VAPID_PUBLIC_KEY`（公開鍵）、`VAPID_PRIVATE_KEY`（秘密鍵）、`VAPID_SUBJECT`（連絡可能な `mailto:` メールアドレスまたはHTTPS URL）を登録し、再デプロイしてください。既存の `SUPABASE_SECRET_KEY` と `CRON_SECRET` もProductionに必要です。秘密鍵・Supabase Secretには `NEXT_PUBLIC_` を付けません。
4. HTTPSで開き、設定 > その他 > 思い出の通知から有効化します。iPhoneは対応するiOS（16.4以降）のSafariで共有 > ホーム画面に追加し、追加したアプリから起動して通知を許可してください。拒否済みの場合は端末・ブラウザ設定で変更します。

既存cleanup Cronは維持し、`/api/cron/memory-reminders` に `0 11 * * *`（毎日20:00 JST頃）を追加しています。Vercel CronはProductionのみで動作し、プランにより時刻が前後します。認証は既存と同じ `Authorization: Bearer CRON_SECRET`。管理clientは通知workerと既存の管理処理だけで使用し、投稿・共有・クイズ・プロフィール・subscription設定はユーザー認証で動作します。

収穫は既存 `buildPersistedTreeItems` と同じ当月アップロード・永続ripen/harvest判定です。過去のこの頃は `memory_date` の1〜3年前±7日（2/29の非うるう年は2/28基準）。両種の候補がある日はユーザー・JST日付で種別を交互に、写真も決定的に選びます。候補なしの日は送信しません。複数端末には同じ1種類を送ります。

日次枠を**送信前**に一意確保し、同日retry・並行実行でも再送しません。外部Push送信との原子的確定はできないため、二重通知防止を優先し、タイムアウト・worker停止日は届かない場合があります（同日の自動再送なし）。`sent_at` はPushサービス受付成功時刻で、端末での表示保証ではありません。TTLは1時間。404/410のみsubscriptionを削除し、一時エラーは残します。ログアウトでは端末とアカウントの全subscriptionを解除し、DB解除失敗時は残留を防ぐためログアウト完了前に再試行を表示します。

デモは木のプレビューON > 日付変更 > 「通知をテスト」。保存済みの過去写真と既存プレビューTreeの収穫判定から、Service Workerでローカル通知を表示します。VAPID・subscription・日次履歴は不要です。サンプル写真は過去写真候補にしません。候補なしの場合は説明だけ表示します。

最短の実機確認：iPhoneで投稿画面 → 一言・日付入力（自動ズームなし／pinch zoom可）→ タグ「文化祭」をEnter追加 → 投稿 → ホームと下部ナビ → slow networkでクイズの読込・reveal・画像エラー → プレビューの日付変更・通知テスト → ホーム画面からPWA起動・通知有効化／無効化・ログアウト。自動テストはOS通知の配信や実機Safariキーボード動作を保証しません。

参考：[Next.js PWA](https://nextjs.org/docs/app/guides/progressive-web-apps)、[Vercel Cron](https://vercel.com/docs/cron-jobs/manage-cron-jobs)。
