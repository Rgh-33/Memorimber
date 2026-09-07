# Shareのメンバー取得500の診断

2026-09-07の読み取り調査では、ローカル `.env.local` とSupabase CLIの接続先が一致し、実DBの最新migrationは `20260907025000` だった。
`public.get_shared_group_profiles(uuid,uuid)` は存在せず、RESTの読み取り確認も `PGRST202` を返した。
070300が未適用であることをユーザーにも確認済み。原因はメンバー取得のRPC段階であり、新規migrationは不要。
その後ユーザーが既存070300を適用し、Shareが正常に動作することを確認した。CodexはDBへの書き込み・migration適用を行っていない。

調査時点では、全ユーザーと共有メンバーの `profile_progress`・`profiles` 欠損は0件で、共有メンバーのNULL snapshotも0件だった。
進捗行がない場合、`private.profile_snapshot` はNULLを返す。profiles行がない場合、共有プロフィールRPCのINNER JOINでそのメンバーが除外される。
070200は既存ユーザーの進捗行を補完し、新規ユーザー用の初期化トリガーも作成している。欠損が後日見つかっても、クライアントでレベルを推測しない。

## ログの読み方

`[shared-members]` ログの `stage` は以下を区別する。

| stage | 失敗箇所 |
| --- | --- |
| `create_client` | サーバー用Supabaseクライアント作成 |
| `auth` | `auth.getUser()`の返却エラー、または例外 |
| `rpc` | `get_shared_group_profiles`の返却エラー、または例外 |
| `map` | レスポンスの形・進捗の検証、または表示用データへの変換 |
| `cleanup_register` | `after()`の登録。メンバーの正常応答は維持 |
| `cleanup_execute` | 登録したcallbackから漏れたcleanup例外。正常応答は維持 |

cleanup内部で処理済みの失敗は、既存の `[shared-cleanup] Retry deferred` と `claim / storage / finish` で識別する。

ログは `code / message / details / hint / stage` のみに限定する。既知のデータを含まない診断文だけ原文を許可し、未認識の自由文は伏せる。
トークン・Cookie・メール・Storage path・個人情報・Secret key・レスポンス本体は出力しない。ブラウザへのエラー文言は従来どおり。

## ユーザー用の読み取り専用SQL

アプリの接続先プロジェクトのSupabase SQL Editorで実行する。プロフィールや認証情報の値は取得しない。

```sql
SELECT max(version) AS latest_version,
  count(*) FILTER (WHERE version = '20260907030000') AS applied_070300
FROM supabase_migrations.schema_migrations;

SELECT to_regprocedure('public.get_shared_group_profiles(uuid,uuid)') AS members_rpc;

SELECT count(*) AS missing_progress_users
FROM auth.users u
LEFT JOIN public.profile_progress p ON p.user_id = u.id
WHERE p.user_id IS NULL;

SELECT count(DISTINCT m.user_id) AS missing_progress_members
FROM public.shared_album_members m
LEFT JOIN public.profile_progress p ON p.user_id = m.user_id
WHERE p.user_id IS NULL;

SELECT count(*) AS missing_profiles_users
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;

SELECT count(DISTINCT m.user_id) AS missing_profiles_members
FROM public.shared_album_members m
LEFT JOIN public.profiles p ON p.id = m.user_id
WHERE p.id IS NULL;

SELECT count(*) AS null_member_snapshots
FROM (SELECT DISTINCT user_id FROM public.shared_album_members) m
WHERE private.profile_snapshot(m.user_id) IS NULL;
```

`applied_070300 = 1` とRPCの存在を別々に確認する。欠損件数とNULL snapshot件数はいずれも0が期待値。
履歴と関数の存在が一致しない場合は適用結果・接続先を確認し、既存migrationの編集や推測による補完migrationの追加はしない。
