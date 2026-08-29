# Memorimber 開発ルール

二人で無理なく開発するための最低限のルールです。分からないことや例外があれば、IssueやPull Requestで相談して決めます。

## 基本方針

- 一つのIssueにつき、一つのブランチを作る
- 普段は各自のPCで開発する
- 完成したらPull Requestを作る
- Vercel Previewで画面を確認する
- もう一人がレビューしてから`main`へマージする
- フロントとDBは同じリポジトリで管理する

## 作業の流れ

1. GitHub Issueを作る
2. `main`を最新にする
3. Issue用のブランチを作る
4. ローカルで開発・確認する
5. コミットしてpushする
6. Pull Requestを作る
7. Vercel Previewで確認する
8. もう一人がレビューする
9. 承認後に`main`へマージする

```bash
git switch main
git pull origin main
git switch -c feature/機能名
```

## ブランチ名

```text
feature/機能名
fix/修正内容
docs/文書名
chore/作業内容
```

例：

```text
feature/auth-login
feature/memory-tree
fix/mobile-navigation
docs/development-rules
```

## mainブランチ

- `main`へ直接コミット・pushしない
- 必ずPull Requestを経由する
- `lint`と`build`を確認する
- もう一人の承認後にマージする

```bash
npm run lint
npm run build
```

## Vercelの使い方

普段の開発はローカルで行います。

```bash
npm run dev
```

Vercel Previewは、Pull Requestの変更を相手に確認してもらうためのサイトです。

```text
ローカルで開発
  ↓
Pull Request
  ↓
Vercel Previewで確認
  ↓
mainへマージ
  ↓
本番サイトを更新
```

コードを保存するたびにVercelへデプロイする必要はありません。

## Supabaseの使い方

```text
各自のローカルSupabase
└─ 個人の実装・テスト用

共有Supabase
└─ Vercel Preview・二人での確認用

本番Supabase
└─ 実際のユーザーデータ用
```

データベース構造は、`supabase/migrations/`のSQLで共有します。

```bash
npx supabase migration new 変更名
npx supabase db reset --local
```

共有Supabaseへ反映するときは、接続先を確認してから実行します。

```bash
npx supabase db push --linked
```

次の操作は共有・本番DBに対して実行しません。

```bash
npx supabase db reset --linked
```

Supabase Dashboardでテーブルを直接変更した場合は、必ずマイグレーションとしてGitへ残します。

## セキュリティ

- `.env.local`をGitへ追加しない
- `service_role`キーをブラウザで使わない
- ユーザー情報を保存するテーブルではRLSを有効にする
- 本人のデータだけを操作できるようにする
- 本番データをローカルへコピーしない
- 秘密情報を見つけたら、マージせず相手へ伝える

## Pull Requestの確認

マージ前に次を確認します。

- [ ] Issueの内容を実装している
- [ ] ローカルで動作する
- [ ] `npm run lint`が成功する
- [ ] `npm run build`が成功する
- [ ] Vercel Previewで確認した
- [ ] DB変更がマイグレーションに入っている
- [ ] 秘密情報が含まれていない
- [ ] もう一人がレビューした

完璧にルールを守ることより、変更内容を相手に伝え、分からないことを相談しながら進めることを優先します。
