# 開発ルール

## 作業の流れ

1. GitHub Issueを作成する
2. Issueごとにブランチを作成する
3. 変更をコミットしてプッシュする
4. Pull Requestを作成する
5. Vercel Previewで確認する
6. もう一人がレビューする
7. 承認後にmainへマージする

## ブランチ名

- feature/機能名
- fix/修正内容
- docs/文書名
- chore/作業内容

## mainブランチ

- mainへ直接コミットしない
- Pull Requestを経由する
- lintとbuildが成功してからマージする
- もう一人の承認を得てからマージする
