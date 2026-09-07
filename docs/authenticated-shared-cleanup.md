# 通常の共有操作をSecret keyなしで運用する変更（#110）

## 状態と適用範囲

- ブランチ: `feature/issue-110-UI-adjust`。mainは参照のみ。
- **実装済み・コード上レビュー済み**。DBへの適用、DBテスト、npm test、ブラウザ/E2E/Safari確認は実行していない。
- 変更するmigrationは **`20260907030000_authenticated_shared_profiles_and_media.sql` だけ**。新しいversionは追加していない。
- ユーザー申告どおり070250以前を適用済みとして扱い、開始時の28ファイルのSHA-256と比較して変更なしを確認。
- 適用順は既存の070250 → 完成版070300。070300の既存の共有プロフィール・アバター・個人クイズ画像対応と、今回のcleanup対応を一緒に適用する。
- 070300が既に適用された環境へ再適用する方式ではない。適用状況が申告から変わった場合は、このファイルを直接再実行しない。

## Secret key未設定時の対応表

以下はコード上の構成。DB・実機で成功したという報告ではない。正常表示には070300の適用が必要。

| 対象 | 実装した経路 | Secret key |
| --- | --- | --- |
| Share表示 | 通常の認証済みserver client | 不要 |
| メンバー取得・プロフィール | `auth.uid()`と同一グループの現メンバー検査を行うRPC | 不要 |
| アバター | 通常認証のStorage読取とサーバーからの画像配信 | 不要 |
| 個人クイズ画像 | 本人の問題・素材を通常認証で検査して配信 | 不要 |
| 共有解除 | 既存の共有行削除＋本人用cleanup | 不要 |
| 退出 | 既存の退出RPC＋本人用cleanup | 不要 |
| メンバー除外 | 既存のオーナー用RPC＋操作した本人のcleanup | 不要 |
| グループ削除 | 既存のグループ削除＋保持画像・アイコンcleanup | 不要 |
| retained cleanup | 成功した共有行削除に由来する本人用処理だけ実行 | 不要（対象限定） |
| アイコン置換・失敗したアップロード | 既存の予約・commit＋予約作成者のcleanup | 不要（対象限定） |
| 全ユーザーのキュー・過去の帰属不明な孤児回収 | 既存の管理者worker/cron | 必要 |
| Authユーザー削除を含むアカウント削除ジョブ | 既存の管理者処理 | 必要 |

## 削除の安全条件

1. `authenticated_storage_cleanup`は成功した共有行DELETEのトリガーで作成する。actorは`auth.uid()`、処理IDはDB生成。NULLのactorでは作成しない。元画像の所有者が残る場合は作成しない。
2. 既存の`on_shared_album_memory_deleted_queue_retained_cleanup`と`retained_memory_cleanup_queue`は維持する。新トリガーは追加のみ。別グループの参照が残る場合も本人用の対象記録は残すが、claim・Storage削除を許可しない。
3. claimは本人の記録だけ。アプリは1回最大2件、RPCは1〜3件に制限。期限切れアイコン予約の整理も同じ上限。対象のmemory/upload → 本人用記録の順でロックし、取得競合はSKIP LOCKEDで待ち続けない。同じmemoryを別ユーザーが同時claimすることを防ぐ。
4. leaseはDB生成トークンと2分の期限。失敗確認後は30秒の再試行待ち。通信断ならlease失効後に再取得する。
5. Storage SELECT/DELETEのRLSは、**そのSQL文の時点**で、本人の処理・有効lease・現在の`user_id IS NULL`・`retained_at IS NOT NULL`・現在パスとの完全一致・現在の共有0件を再確認する。古い処理記録だけでは削除できない。
6. 部分削除後も、対象のパス・所有状態変更と新しい共有参照追加を防ぐ。lease失効で安全条件が解除される構成にしない。本人所有写真の通常の再共有は対象外。
7. 完了RPCは、現在状態・共有0件・対象Storageオブジェクトの不存在をDBで再確認する。成功時だけ、保持memory、同じmemoryの本人用記録、global queueを同じトランザクションで整理する。失敗時はglobal queueを削除しない。
8. ブラウザ向けレスポンスにcleanupパス・leaseを追加しない。サーバーログは処理ID・段階だけで、画像URL・パス・トークンを出さない。
9. 通常の共有一覧・メンバーAPIでは`after`でレスポンス後に少件数を再試行する。cleanupのための写真一覧・元画像・signed URL再取得や定期ポーリングは追加していない。

## 変更ファイルと理由

| ファイル | 変更理由 |
| --- | --- |
| `supabase/migrations/20260907030000_authenticated_shared_profiles_and_media.sql` | 本人用処理記録、追加トリガー、RLS、claim/finish RPC、管理者workerの完了確認RPC |
| `lib/supabase/authenticated-cleanup.ts` | 通常クライアントで最大2件のStorage削除とDB完了確認。失敗を主要操作へ伝播させない |
| `app/shared-groups/actions.ts` | 共有解除・退出・除外・グループ削除で同じ通常クライアントをcleanupへ渡す |
| `app/shared-groups/page.tsx` | **今回唯一のTSX変更**。認証済みの共有一覧表示後に保留分を再試行するため、import 2行と`after` 1行を追加。JSX・className・文言・遷移・操作は変更なし |
| `app/api/shared-groups/[groupId]/members/route.ts` | 正常なメンバー取得後、レスポンス後に本人の保留処理を再試行 |
| `app/api/shared-groups/[groupId]/presentation/route.ts` | アイコンの置換成功・失敗後の再試行を接続 |
| `lib/supabase/account-deletion-runner.ts` | 管理者回収でも削除前に参照を確認し、完了をDBで検証。本人の有効leaseがある対象はスキップ |
| `lib/supabase/group-icon-cleanup.ts` | 管理者が回収したアイコンの本人用記録もDB確認後に整理 |
| `tests/authenticated-cleanup.test.mjs` | 上限、同じクライアント、DB完了確認、途中失敗・機密ログ防止の未実行テスト |
| `tests/shared-group-actions.test.mjs` | 新しいcleanup実装を使い、主要操作の成功とcleanup障害の分離を検証する構成に更新（未実行） |
| `supabase/tests/database/authenticated_cleanup.test.sql` | 本人/部外者、共有0件、NULL actor、lease・パス、部分失敗、3者の完了整合の未実行DBテスト |

## レビュー結果・制限

- 管理者キュー全体を通常クライアントへ渡していた依存を除去。新規RPCはcaller IDを入力に取らず、任意パスによる削除受付も設けていない。
- `SECURITY DEFINER`は空のsearch_pathと完全修飾テーブル名。内部関数は実行権限を剥奪し、RLS判定関数と本人RPCだけauthenticatedへ許可。global RPCはservice_roleのみ。profilesのSELECT権限は今回変更していない。
- ON CONFLICTは明示した制約名を使い、RETURNS TABLEの出力変数との衝突を避けた。leaseのNULL組合せ、対象種別、対象パス、件数上限を検査。
- アイコンのStorage INSERTが許可判定後に予約失効処理へ追い越されないよう、既存のupload判定関数を070300で置換。予約行をStorageトランザクション中ロックし、取得後にも期限を確認する。
- 同時に最後の共有が解除される場合、解除対象を記録してcommit後に再判定する。claim時、必要ならglobal queueを補完する。
- SQLの状態検査とStorage APIは別トランザクション。部分成功と通信断を前提として、失敗時に利用中画像へ復帰できないよう参照・パスを保護する。並行実行の実測は未確認。
- 失敗時の自動再試行は、本人の後続アクセス・操作が必要。誰もアクセスしない状態での全体回収は管理者workerに残る。
- 070300適用前から存在するglobal queueに本人の操作情報を推測で付けない。既存の`cleanup`状態のアイコンにも過去の一般ユーザー権限を推測で追加しない。
- 本人用記録がある保持写真の「管理者による再共有・画像パス差替え」は保護トリガーが拒否する。通常UIでは元々できない操作であり、将来の管理者復旧ツールでは別途設計が必要。
- UI新設・オーナー移譲は行っていない。元仕様の受け入れ一覧は既存の[永続化引継ぎ文書](supabase-persistence-implementation.md)を維持する。

## Git参照・migration番号

2026-09-07に`git fetch --no-tags origin`後、ローカル・originの計65参照を確認。

- origin/main: `da76d4131fa6126c28a2832377cd4bff5a4a169e`
- 確認時origin/feature/issue-110-UI-adjust: `38a25de992f8b28110153fceaec2a68128189804`
- 作業ブランチ、origin/mainにversion重複なし。既知の最新versionは`20260907030000`。新規version追加なし。
- 別参照に既存重複あり（変更していない）：`issue-103-share-ui`、`issue-79-safari-golden-fruit`、`rgh-33/nice`のローカル/origin、およびoriginの`kinomigarasu`で`20260905080000`。`issue-83-shared-group-ui`のローカル/origin、およびoriginの`issue-88-memory-thumbnails-ui`で`20260905000000`。
- 後から他担当が追加するmigrationや実際のDB適用履歴は、このGit確認では保証しない。

## ローカル確認手順（ユーザー担当・未実行）

1. 作業ブランチの完成版070300を確認し、対象ローカルDBが070250まで適用済み、070300未適用であることを確認する。migrationの適用はユーザーが行う。
2. ローカルアプリの`SUPABASE_SECRET_KEY`を未設定にして再起動する。通常のURL・publishable key・ログイン認証は必要。
3. Share表示、メンバー一覧・プロフィール・アバター、個人クイズ画像が取得できることを確認する。グループ外ユーザーのプロフィールは404となることを確認する。
4. 他ユーザーの退会後に残った保持写真を準備する。本人所有写真とは分け、元画像とサムネイルの両方があるものを使用する。Authユーザー削除の準備は従来の管理者処理が必要。
5. 2グループ共有の片方だけ解除し、画像が残ることを確認する。最後の共有解除後は、Storage両画像・retained memory・本人用処理・global queueが整理されることを確認する。
6. キャンセルでは解除されず、確定時だけ解除されることを確認する。本人所有写真を解除しても元画像・memoryが残ることを確認する。
7. 退出、メンバー除外、グループ削除を確認する。削除対象がない場合も主要操作が成功し、グループを全部削除した後も共有一覧へのアクセスで本人の保留分を処理できることを確認する。
8. 部分失敗（片方の画像だけ削除成功）、Storage障害、レスポンス喪失を再現する。主要操作やShare表示は成功し、global queueは残り、lease失効後の再試行で完了することを確認する。
9. 別ユーザー・匿名で処理IDや画像パスを流用しても削除できないこと、期限切れleaseでStorage DELETEできないこと、旧leaseで完了できないことを確認する。
10. 2セッションで同じ対象をclaimし、同時に処理権が出ないことを確認する。2グループの最後の共有を同時解除した場合も、対象が回収されることを確認する。管理者workerとの同時実行も確認する。
11. アイコン置換・グループ削除で古いアイコンが回収され、利用中アイコンは残ることを確認する。アップロード中断時は予約の15分期限経過後、本人のアクセスで再試行する。
12. Networkで、cleanupが理由の写真一覧取得・画像ダウンロード・signed URL再生成・15秒ポーリングが増えていないことを確認する。Console/サーバーログにパス・URL・トークンが出ないことも確認する。
13. `npm test`と既存DBテスト＋追加DBテストをユーザー側で実行する。Storage HTTPの確認とSQLのStorage RLS確認は別々に行う。
14. Safari（Mac/iPhone）・Chromeで既存のメニュー、確認ダイアログ、設定の見た目と操作が維持されることを確認する。

## Codex実行範囲

- `npm run lint`: 成功（exit 0）。
- `SUPABASE_SECRET_KEY= npm run build`: 成功（exit 0）。Next.js 15.5.23、TypeScriptチェック成功、静的ページ13件生成。
- 独立した型チェックコマンドはpackage.jsonにない。build内で確認。
- `git diff --check`: 成功。JSX本文が開始時と同一であることを比較確認。
- buildが生成した`next-env.d.ts`の参照先変更は元に戻し、コミットに含めない。
DB適用・DBテスト・npm test・E2E・ブラウザ・実機確認・デプロイは実行していない。
