# 現在UIのSupabase永続化：実装と確認の引き継ぎ

## 対象と状態

作業ブランチは `feature/issue-110-UI-adjust`。開始HEADは `d07a38e03823de7266f6b88376d21630cdeced7d`。
mainは比較のみで、merge/rebase/cherry-pickしていません。開始時の未追跡 `UIイメージ/` は変更していません。

今回の実装は現在の画面の保存・取得接続です。表示用コンポーネントへ移動したmarkupも含め、既存の配置、className、通常時の文言、アイコン、ダイアログ、設定項目、操作を維持しています。CSS・package.json・lockfileに変更はありません。

- 実装済み：DB進捗・記録、個人クイズ保存、共有設定・アイコン、メンバープロフィール、共有クイズのDB設定参照、共有データキャッシュと変更通知。
- コード上確認済み：既存migrationの不変、権限境界、baseline順序、冪等性、UI差分、画像取得経路。
- テスト未実行：npm test、DBテスト、E2E、ブラウザ操作、Safari・iPhone。
- DB未適用：migration適用、DBのSQL実行、Storageへの実データ書き込み、Supabase設定変更、デプロイは行っていません。
- lint/buildの最終結果は末尾の検証記録を参照してください。ビルドはDB関数やRLSの動作確認にはなりません。

## 永続化の動作

`profile_progress` は到達レベルを保持し、`profile_activity_events` のユーザー・種別・source IDを一意にします。カウンター加算と昇格は進捗行のロック内で行います。活動条件のbaselineは最初の対象イベントより前に作成し、昇格後の次条件は当該イベントを含んだ累計を基準にします。

現在値は所有写真・活動月・所属グループ・他メンバーの重複排除人数・個別デザイン数から取得します。UI向けのmetric名は既存TypeScriptのcamelCase名を使用しています。累計は削除操作で減らしません。写真進捗の数値は負数・超過を保持します。

個人クイズの問題・選択肢・正答はDBで保存し、回答送信は問題IDと選択肢IDです。総集クイズの追加問題も同じ保存経路です。花びら復活は収穫/前回復活・表示からの7日経過と回答済みを確認し、不正解でも復活できます。収穫RPCも木の実クイズの回答済みを検査します。

印刷/PDF押下と花びら表示は認証済みクライアント申告です。source IDは1〜128文字、新規イベントはユーザー単位で毎分60件まで。再送は加算しません。花びら表示では所有する収穫済み写真も検査しますが、実際の物理操作を証明するものではありません。

共有追加は挿入行ごとにDBが新しいUUIDを発行します。既存行との競合は挿入失敗となり、加算しません。解除後に挿入し直した行は新しい成功です。手紙保存はDBの行更新で非空の本文が実際に変わった場合だけ、DB生成UUIDで記録します。クライアント指定のletter_save_id列・送信処理は廃止しました。同じ本文の再送、前後の空白だけの変更、本文以外の更新では加算しません。新規思い出と同時に保存した非空の手紙も対象です。

### 過去履歴

backfillは通常運用のイベント登録関数を呼びません。残存する収穫・共有・作成グループ・共有クイズの履歴識別子を直接記録し、表示用累計をSQL集計します。識別子を保存する目的は、既存セッションの再処理で過去分が加算されないようにすることです。

途中でbaselineが既に存在する場合も、取り込んだ過去累計の差分だけbaselineへ加えて、過去分を新規活動として数えないようにします。その後に現在写真数で初期昇格を評価します。追加条件有効化時のbaselineはbackfill済み累計です。移行前に収穫20回があっても、新しく有効になったレベル10条件では20を基準に、移行後の5回が必要です。通常・総集・木の実・復活クイズの過去回答、印刷、花びら復活・表示など履歴がない分は0開始です。消失した履歴やブラウザ値は復元・移行しません。

### 共有キャッシュとEgress

本人所有のMemories Contextと共有写真は別管理です。共有は認証ユーザーID＋groupIdで分離したメモリ内キャッシュを使います。署名URLとexpiresAtもメモリ内だけに保持します。

Realtime payloadは状態へ取り込まず、version再確認の通知として使用します。写真・設定・メンバーのversionを分け、変わった種類だけ取得します。表示・focus・再接続時も同じversionなら写真一覧を再取得しません。設定保存で写真を取得し直しません。15秒ポーリングや画像の定期ポーリングは追加していません。

有効な署名URLは再利用し、使用時に残り60秒未満のものだけ更新します。URL更新だけなら写真一覧を取得し直しません。元画像は実際の詳細表示時だけ取得し、リンク先読みでは取得しません。ログアウト・ユーザー切替・所属喪失で該当キャッシュを破棄します。通信中に失効した古い結果も復元しません。

既存の共有クイズ待機室には1.5秒ごとの参加状態更新が残りますが、サーバーの画面取得から写真一覧と署名URL発行を外してあるため、画像取得にはつながりません。

### 権限・アイコン

設定は現メンバーが閲覧し、現オーナーだけ更新できます。オーナー変更禁止の既存関数・triggerは変更していません。

メンバープロフィールは認証済みサーバー処理が両者の現所属を検査し、必要な項目だけ返します。対象不存在、対象/呼び出し元がグループ外、退出済みは同じ404です。profiles全体のSELECT権限は広げていません。管理用クライアントで署名するアバターパスは、対象本人の既存アップロード形式に制限しています。

アイコンは5MB以下のJPEG/PNG/WebPを検証し、中央256px正方形のWebPへ変換します。アップロード予約を作り、新規Storage保存、DB参照更新、旧画像のcleanup登録の順で処理します。中断した予約は15分後にcleanup対象になります。既存のcronエンドポイントで削除を再試行します。削除対象が現在の参照でないことを確認し、cleanupになったパスは再コミットできません。保持画像の後片付け処理は変更していません。

## 新規migrationの適用順

既存の22本の後に、下表を昇順で適用してください。Codexは適用していません。

| version・ファイル | 役割 |
| --- | --- |
| `20260907020000_profile_progress_foundation.sql` | 進捗・活動・baseline、表示用集計、クライアントイベント、RLS |
| `20260907021000_verified_profile_activity_sources.sql` | 個人クイズ・花びら復活・収穫検証・共有/手紙イベント |
| `20260907022000_shared_group_persistence.sql` | 共有設定・アイコンStorageとcleanup・プロフィール取得権限 |
| `20260907023000_server_configured_shared_quizzes.sql` | DB設定からの出題、開始時固定、回答・最終順位・活動記録 |
| `20260907024000_shared_group_change_notifications.sql` | 軽量version、Realtime通知、所属喪失通知 |
| `20260907025000_profile_history_backfill.sql` | 過去識別子・累計の直接集計、初期レベル/baseline、過去順位snapshot |

既存オブジェクトの存在を黙って正しいと仮定しないため、新規テーブル等に無条件の `IF NOT EXISTS` を付けて既存定義を隠していません。実DBに同名の手作業オブジェクトがあれば、定義を確認してから適用してください。

## レビューで修正した点

- 共有写真がサーバー描画ごとに再取得・再署名される経路を、ユーザー・グループ別キャッシュへ接続。
- 個人クイズのクライアント採点を保存済み問題に対するDB採点へ変更。
- 共有クイズ開始時のhidden input採用を廃止。問題方式、参加者、秒数、caption/dateを開始時に固定。
- shared quizのjoinとstartでalbum→quizのロック順を統一。
- 進捗からグループversion行への逆順ロックを避けるため、レベル通知を別の軽量行へ分離。所属変更の通知はユーザーID順に処理。
- 共有クイズ完了順位を保存し、後から履歴が削除されても確定結果を再計算しない。
- 通常のテーブルUPDATEからアイコン参照更新を迂回できないよう列権限を制限。
- メンバープロフィールの所属検査とデータ投影を同じSQL文のsnapshotで行い、検査と取得の間の所属変更による情報漏えいを防止。
- profiles.avatar_urlのユーザー入力を管理権限で無条件に署名しないよう本人のパスを検証。
- URL期限と重複リクエストを管理し、失効したキャッシュが非同期応答で復活しないよう世代を検査。
- アカウント削除のcascade中に、削除済みAuthユーザーの進捗行を作り直してFK違反にならないよう内部更新を停止。
- 新規キャッシュの型エラーを修正。型チェック・lint・権限チェックは無効化していません。

## 保留・適用前に確認する点

- オーナー移譲は今回対象外。冠の確認は現在のDB roleとの一致まで。
- 現在の共有クイズのカード構造、設定説明の「このタブ内」など、仕様書と異なる見た目・文言は変更していません。
- Supabaseに残る過去履歴の実際の量、適用済みversion、手作業オブジェクト、RLS/Storageの実動作は未確認です。
- 今回のメンバー画像署名で、既存の `SUPABASE_SECRET_KEY` がサーバー側に必要です。既存のcleanup実行にも `CRON_SECRET` と定期呼び出しが必要です。値をブラウザへ渡さないでください。
- `supabase_realtime` publicationが存在する場合は通知用テーブルを追加します。存在しない場合、操作成功・画面表示・focus時のversion確認は使えますが、他端末のリアルタイム反映は別途設定が必要です。
- 発行済み署名URLそのものは期限まで有効です。アプリのキャッシュ破棄と、既に取得したURLの失効は別です。
- ブラウザ保存の旧グループアイコン・設定・レベルは引き継がれません。オーナーが現在の既存操作から再保存してください。
- 適用前にアプリの書き込みを停止し、既存migration→新規6本→対応アプリの順で切り替えてください。古い画面からは新しいクイズ回答・収穫検証を満たせません。
- rollbackはこの新規ファイルを改名・削除する方法では行わず、適用後の状態に合わせた後続migrationとして検討してください。

## ユーザーが行うローカル確認

### 準備とテスト実行

1. ローカルの適用履歴・schemaを確認し、下記Git監査の既存重複と実DBの履歴を混同しないことを確認する。
2. バックアップを確保し、アプリの書き込みを停止した状態で新規migrationを昇順適用する。
3. オーナーA、メンバーB、部外者Cの3アカウント、A/Bが共通所属する2グループ、各自のプロフィール画像、共有可能な写真を準備する。
4. ユーザー担当で `npm test` とローカルDBテストを実行する。今回追加のDBテストは `supabase/tests/database/profile_persistence.test.sql`。既存共有クイズテストもサーバー生成問題を読むよう更新している。
5. `tests/e2e/profile-persistence.mjs` はPlaywrightを利用できるユーザー側テスト環境で実行する。認証済みstorageStateを `MEMORIMBER_STORAGE_STATE`、必要ならローカルURLを `MEMORIMBER_TEST_URL` に指定し、`node tests/e2e/profile-persistence.mjs` でChromium/WebKitを確認する。依存追加・ブラウザ取得・実行はCodexでは行っていない。
6. Safari/iPhoneは別途実機で確認する。WebKit自動テストの結果をSafari実機確認として扱わない。

### 仕様書の受け入れチェックリスト（削除せず引き継ぎ）

- [ ] 写真削除でも到達済みレベルが下がらない。
- [ ] `-1/15`、`32/15`、昇格後の `17/15` を表示できる。
- [ ] 過去活動が後から有効になった条件へ入らない。収穫履歴20回の移行例も確認する。
- [ ] 同じイベントの再送で二重加算しない。
- [ ] 記録16個が4×4、初期状態は説明なし。
- [ ] 選択した記録の説明はその行の下に出て下段だけが動く。同じアイコンで閉じ、同時に一つだけ開く。
- [ ] 接続人数は自分を除外し、2グループにいる同一人物を1人と数える。
- [ ] 1人共有クイズでは1位記録を増やさない。
- [ ] 3枚一括共有で累計が3増え、再読み込み・同じリクエスト再送で増えない。解除後の再共有は新しい1件になる。
- [ ] 設定のメンバーに本人のプロフィール画像が出る。
- [ ] DB roleがownerの人だけに冠が付く。
- [ ] 既存の各名前・レベル表示にサーバー確定のLv.Nが出る。
- [ ] 既存のメンバーアイコンからプロフィールを開ける。
- [ ] メンバープロフィールにカメラ・鉛筆がない。
- [ ] メンバープロフィールで既存のレベル条件と16記録を操作できる。
- [ ] 戻る矢印で元のグループへ戻れる。
- [ ] 部外者・対象不存在・退出済みのプロフィールAPIは同じ404。自己プロフィールでもグループ経由は編集不可。
- [ ] **今回対象外／別Issue候補：オーナー変更後に冠が新オーナーへ移る。移譲機能は追加していない。**
- [ ] オーナーの設定変更が別端末のメンバーにも反映される。
- [ ] 写真表示が両方OFFなら既存の正方形3列表示になる。
- [ ] カスタム合計10以外はサーバーが拒否する。
- [ ] 秒数3/5/10以外とNULLを拒否する。
- [ ] 投稿者均等モードで0枚の参加者を除き、非ゼロ最小枚数ずつの集合から10問作る。
- [ ] 小さい端末でも現在の設定画面の最下部までスクロールできる。

### 追加の整合性・通信確認

- [ ] 木の実/通常/総集/復活/共有クイズの正解がDB確定後に一度増える。採点値を改ざん送信しても採用されない。
- [ ] 木の実収穫・花びら生成・金の木の実・グループ作成・手紙保存が成功した時だけ反映される。
- [ ] 不正解で回答した復活クイズからも花びらを戻せる。7日条件未達や未回答ではRPCが拒否する。
- [ ] 送信失敗後に既存操作から再試行でき、連打・リロードで二重加算しない。
- [ ] 印刷キャンセルやPDF生成失敗でも押下記録は取り消されない。クライアントイベントの61件目はレート制限される。
- [ ] 共有クイズの進行中に設定を変更しても、出題・方式・参加者・期限が変わらない。
- [ ] 共有解除は確認画面の確定後だけ行われ、キャンセルで解除しない。元画像を削除しない。
- [ ] アイコン置換のupload失敗・DB更新失敗・旧画像削除失敗で現在の画像を失わない。cleanup再実行で利用中の画像を消さない。
- [ ] 古いlocalStorage/sessionStorageの偽レベル・設定を入れてもDBや画面の確定値を上書きしない。
- [ ] Networkで、詳細→戻る→再表示やfocus復帰時にversion同一なら共有一覧・画像署名リクエストが増えない。
- [ ] 設定変更だけでは共有写真一覧を取得しない。Realtime payload改ざんでは状態を確定しない。
- [ ] 署名期限が近い画像だけ再署名し、元画像は詳細を実表示した時だけ取得する。
- [ ] ログアウト・ユーザー切替・退出・除外・削除で別ユーザー/別グループのキャッシュが表示されない。
- [ ] 同時回答、共有追加、写真更新、複数グループ操作を別接続で実行し、ロック競合・再送時の結果を確認する。

## 変更ファイルとTSXの接続理由

| TSXファイル | 接続理由 |
| --- | --- |
| `app/profile/page.tsx` | 本人のレベル・16記録・取得エラーを既存表示へ接続。 |
| `app/quiz/page.tsx` | 既存の開始・回答・次問・履歴を個人クイズRPCへ接続。 |
| `app/shared-groups/[groupId]/members/[userId]/page.tsx` | 両者の所属確認付きサーバープロフィール取得へ接続。 |
| `app/shared-groups/[groupId]/memories/[memoryId]/page.tsx` | 認証と軽量metadataのみ取得し、既存詳細表示をキャッシュ利用コンポーネントへ移動。 |
| `app/shared-groups/[groupId]/page.tsx` | 画面表示ごとの共有写真取得を外し、既存表示をキャッシュ利用コンポーネントへ移動。 |
| `app/shared-groups/[groupId]/quiz/[sessionId]/page.tsx` | 参加状態の取得と写真取得を分離し、写真は共通の共有キャッシュから供給。 |
| `app/shared-groups/page.tsx` | 現在の名前・レベル表示にサーバー確定のメンバー情報を渡す。 |
| `components/fruit-quiz-dialog.tsx` | 既存回答ボタンを保存済み問題の採点へ接続。エラーは既存領域へ表示。 |
| `components/memory-recall-dialog.tsx` | 既存回答・花びら復活ボタンを検証RPCへ接続。 |
| `components/memory-tree.tsx` | 復活・表示の日時をDBから読み、花びら表示イベントへ対象IDを渡す。 |
| `components/session-boundary.tsx` | 既存ログアウト/セッション遮断時に共有メモリキャッシュを破棄。 |
| `components/shared-group-controls.tsx` | 既存保存操作がDB保存完了を待ち、既存画像選択をupload APIへ接続。 |
| `components/shared-group-detail.tsx` | 既存グループ詳細markupの移動先。共有キャッシュと本人用の共有候補を別々に取得。 |
| `components/shared-group-presentation.tsx` | sessionStorageを廃止し、同じhookをAPI・キャッシュへ接続。 |
| `components/shared-member-profile.tsx` | 仮レベル・ゼロ固定記録を所属確認済みDB値へ置換。 |
| `components/shared-memory-detail.tsx` | 既存写真詳細markupの移動先。実表示時のみ対象元画像をキャッシュ経由で取得。 |
| `components/shared-quiz-room-data.tsx` | 既存SharedQuizRoomへキャッシュ内の写真・メンバー情報を渡す非視覚的な接続層。 |
| `lib/profile-level-context.tsx` | ブラウザ昇格・累計を廃止し、サーバー確定値と限定クライアントイベントへ接続。 |

その他の変更ファイル（新規を含む）：

- `app/api/cron/account-deletion-cleanup/route.ts`
- `app/api/profile/route.ts`
- `app/api/shared-groups/[groupId]/members/[userId]/profile/route.ts`
- `app/api/shared-groups/[groupId]/members/route.ts`
- `app/api/shared-groups/[groupId]/presentation/route.ts`
- `app/shared-groups/actions.ts`
- `docs/supabase-persistence-implementation.md`
- `lib/personal-quiz.ts`
- `lib/profile-avatar-path.ts`
- `lib/profile-progress.ts`
- `lib/shared-group-cache.ts`
- `lib/shared-quiz.ts`
- `lib/supabase/group-icon-cleanup.ts`
- `lib/supabase/group-profiles.ts`
- `lib/supabase/memories.ts`
- `lib/supabase/shared-albums.ts`
- `lib/supabase/shared-quiz.ts`
- `lib/use-persisted-memory-question.ts`
- `supabase/migrations/20260907020000_profile_progress_foundation.sql`
- `supabase/migrations/20260907021000_verified_profile_activity_sources.sql`
- `supabase/migrations/20260907022000_shared_group_persistence.sql`
- `supabase/migrations/20260907023000_server_configured_shared_quizzes.sql`
- `supabase/migrations/20260907024000_shared_group_change_notifications.sql`
- `supabase/migrations/20260907025000_profile_history_backfill.sql`
- `supabase/tests/database/profile_persistence.test.sql`
- `supabase/tests/database/shared_quizzes_rls.test.sql`
- `tests/e2e/profile-persistence.mjs`
- `tests/profile-level.test.mjs`
- `tests/profile-persistence.test.mjs`
- `tests/shared-group-ui.test.mjs`
- `tests/shared-quiz.test.mjs`
- `tests/shared-thumbnail-egress.test.mjs`

## Git上のmigration監査

リモートを再取得後、ローカル・originの65参照を確認。取得したorigin/mainは `da76d4131fa6126c28a2832377cd4bff5a4a169e`。Git参照の既知最大versionは `20260907010000`、作業ディレクトリ内は既存22本＋新規6本でversion重複なし。有効な14桁日時も確認。既存22本は作業開始時のSHA-256と一致しています。実DBの適用履歴は調査していません。

既存の重複がある参照（今回編集・改名なし）：

- `feature/issue-103-share-ui`: `20260905080000`
- `feature/issue-79-safari-golden-fruit`: `20260905080000`
- `feature/issue-83-shared-group-ui`: `20260905000000`
- `feature/rgh-33/nice`: `20260905080000`
- `origin/feature/issue-103-share-ui`: `20260905080000`
- `origin/feature/issue-79-safari-golden-fruit`: `20260905080000`
- `origin/feature/issue-83-shared-group-ui`: `20260905000000`
- `origin/feature/issue-88-memory-thumbnails-ui`: `20260905000000`
- `origin/feature/kinomigarasu`: `20260905080000`
- `origin/feature/rgh-33/nice`: `20260905080000`

同一versionの別名ファイルは古いブランチ間にも存在します。これらを新規migrationの重複と混同しないでください。他担当者が今後追加するversionまでは保証していません。

<details><summary>確認したGit参照一覧</summary>

- `feature/issue-103-share-ui`
- `feature/issue-105-quizvs`
- `feature/issue-107-quiz-supabase`
- `feature/issue-110-UI-adjust`
- `feature/issue-15-memory-detail`
- `feature/issue-17-memory-fruits`
- `feature/issue-35-konohaan`
- `feature/issue-61-quizlet`
- `feature/issue-64-album-preferences-sync`
- `feature/issue-69-iphone-scroll`
- `feature/issue-71-preview-footer`
- `feature/issue-73-provider-memory-cache`
- `feature/issue-75-arubamunext`
- `feature/issue-79-golden-migration-fix`
- `feature/issue-79-safari-golden-fruit`
- `feature/issue-83-shared-group-ui`
- `feature/issue-84-account-deletion-retention`
- `feature/quizBGM`
- `feature/rgh-33/nice`
- `fix/issue-101-shared-album-invitations`
- `fix/issue-99-shared-album-creation-rls`
- `main`
- `origin/1u3yl0-codex/create-feature/issue-30-memory-storage-branch`
- `origin/4haeog-codex/implement-profiles-table-and-rls`
- `origin`
- `origin/codex`
- `origin/ec0q0e-codex/readme`
- `origin/feature/issue-103-share-ui`
- `origin/feature/issue-105-quizvs`
- `origin/feature/issue-107-quiz-supabase`
- `origin/feature/issue-110-UI-adjust`
- `origin/feature/issue-15-memory-detail`
- `origin/feature/issue-17-memory-fruits`
- `origin/feature/issue-34-save-memories`
- `origin/feature/issue-35-konohaan`
- `origin/feature/issue-35-tapiokaan`
- `origin/feature/issue-40-profile-sync`
- `origin/feature/issue-61-quizlet`
- `origin/feature/issue-64-album-preferences-sync`
- `origin/feature/issue-65-album-preferences-sync`
- `origin/feature/issue-69-iphone-scroll`
- `origin/feature/issue-71-preview-footer`
- `origin/feature/issue-73-provider-memory-cache`
- `origin/feature/issue-75-arubamunext`
- `origin/feature/issue-79-golden-migration-fix`
- `origin/feature/issue-79-goldenkinomi`
- `origin/feature/issue-79-safari-golden-fruit`
- `origin/feature/issue-80-required-username-onboarding`
- `origin/feature/issue-81-shared-album-rls`
- `origin/feature/issue-82-email-invites-notifications`
- `origin/feature/issue-83-shared-group-ui`
- `origin/feature/issue-84-account-deletion-retention`
- `origin/feature/issue-85-memory-thumbnails-db`
- `origin/feature/issue-88-memory-thumbnails-ui`
- `origin/feature/issues-55-arubamuui`
- `origin/feature/kinomigarasu`
- `origin/feature/nextjs-gattyannko-supabase`
- `origin/feature/quizBGM`
- `origin/feature/rgh-33/nice`
- `origin/fix/issue-101-shared-album-invitations`
- `origin/fix/issue-99-shared-album-creation-rls`
- `origin/gwn5uz-codex/implement-supabase-client-and-auth-session`
- `origin/main`
- `origin/test/vercelpreview`
- `origin/ysp55o-codex/fix-user-name-storage-issue`

</details>


## 最終検証記録

- `npm run lint`：終了コード0、成功。
- `npm run build`：終了コード0、成功。Next.js 15.5.23でコンパイル、TypeScript検査、静的ページ13件生成、build tracesまで完了。
- 独立した型チェックscriptはpackage.jsonにありません。build内の型チェックは成功しています。
- `git diff --check`：問題なし。
- UI静的比較：変更した既存TSX15ファイルについて、移動先のmarkupも含めclassName属性の追加・削除なし。CSS、package.json、lockfileは未変更。buildが生成したnext-env.d.tsの参照パス変更は作業前の内容へ戻しています。
- migration最終再監査：65 Git参照、新規6 versionは既知Git最大versionより後で重複なし。既存22ファイルは開始時SHA-256と一致。
- 未実行：npm test、追加/更新したNodeテスト、pgTAP、E2E、ブラウザ操作。追加テストは冪等性・baseline・進捗・権限・キャッシュ再利用・旧保存値の無視などを対象としますが、合格を確認していません。
- DB未適用、Storage未操作、Safari/iPhone/Chromium/WebKit実機・自動ブラウザ未確認。SQLはコードレビューまでで、適用可否・並行トランザクション・RLS/Storage動作はユーザー側の確認が必要です。

この文書の手順・受け入れチェックリストでローカル確認してからDB反映を判断してください。オーナー移譲は保留のままです。


## 未適用migrationの直接修正（個人クイズ・手紙の改ざん対策）

ユーザー確認により、`20260907010000`〜`20260907025000`は全て未適用です。今回はそのうち `20260907021000_verified_profile_activity_sources.sql` だけを直接修正しました。追加の修正migrationは作成していません。これより前の適用済みmigrationは変更しません。

### 修正内容・変更ファイル

- `supabase/migrations/20260907021000_verified_profile_activity_sources.sql`：選択肢ごとにランダムUUIDを生成。思い出ID・日付との対応と採点キーは非公開テーブル内に保持。回答前DTOは明示した表示項目だけに限定し、対象memoryId、本文、日付、写真選択肢のcaption、選択肢と写真の対応を返しません。月の正解が常に候補の中央になる生成も修正しました。
- `app/api/personal-quizzes/[questionId]/media/route.ts`：問題ID・選択肢IDから認証付きで画像を返します。本人の問題かをDBで確認し、Storageにも本人権限でアクセスします。生のパス・元画像URLへリダイレクトせず、EXIF/XMPの日付・説明も除去して返します。caption-to-photoでは回答前の対象写真取得、photo-to-captionでは選択肢からの写真取得を拒否します。
- `lib/personal-quiz.ts`：回答前は安全なDTOをそのまま表示へ渡し、Memories Contextから正解メタデータや選択肢の対応を復元しません。回答後だけ、既存の本人画像キャッシュを利用します。
- `lib/supabase/memories.ts`：クライアントUUIDを保存payloadから除去。手紙本文そのものの保存方法・既存操作は維持します。
- `supabase/tests/database/personal_quiz_privacy.test.sql`：回答前の秘匿、opaque ID、画像取得権限、回答再送、他人の回答取得拒否、手紙の偽ID・同文再送・保存失敗・baselineの初回加算を確認するユーザー実行用テスト。Codexでは未実行です。
- 本文書：上記の変更と確認手順を追記しました。TSX、文言、className、レイアウトに変更はありません。

### 依存・権限・イベントの再レビュー

- `070200`：イベント種別・metric・関数引数に変更なし。進捗行ロック、イベント前のbaseline作成、加算後の再評価を維持。
- `070210`：私的な問題テーブルを先に作成し、DTO・画像検索関数、その後に生成/回答関数の順に定義。画像検索RPCはservice_roleだけ実行可能。HTTP処理では検証済みauthユーザーだけをcallerとして渡します。SECURITY DEFINERは空search_pathと修飾したテーブル名を使用します。
- `070230`：共有クイズは別の出題データ・回答関数であり、個人のchoice構造やletter_save_idへの参照はありません。
- `070250`：既存DBからの確定履歴だけを直接集計します。通常運用イベントの再生は行いません。手紙の旧成功履歴がないため、過去の本文が残っていても保存イベントを捏造しません。backfill済み累計をbaselineへ含める順序は変更しません。
- 個人の回答確定は質問行をロックし、既回答なら確定済み結果を返します。ランダムIDでも既存のイベント一意制約・再送抑止は維持します。
- 手紙はmemoriesの行ロック下の本文比較とAFTER triggerでイベントを同じトランザクションへ記録します。DB制約で保存が失敗した場合はイベントも残りません。同じ本文を再送しても増えません。別の非空本文へ実際に変更した保存は新しい成功として扱います。
- 新しい関数はRETURNS TABLEを使わず、列参照・関数引数を区別しています。既存の出力変数、ON CONFLICTの制約指定は変更しません。

### ローカル確認の追加手順（ユーザー担当）

1. 適用済みの旧migrationに続けて、修正後の未適用7本を `070100` → `070200` → `070210` → `070220` → `070230` → `070240` → `070250` の順に適用する。途中まで旧版を適用済みの環境には、そのまま差し替えて適用せず履歴を確認する。
2. `personal_quiz_privacy.test.sql` と既存の `profile_persistence.test.sql` を実行する。
3. 通常・総集・木の実・復活クイズを開き、Networkの回答前JSONに正解のmemoryId/本文/日付/内部pathがなく、選択肢が問題固有のUUIDであることを確認する。本文を問う選択肢や出題文など、UIに必要な表示情報は返る。
4. 画像URLを開いてもStorageへリダイレクトされないこと、他アカウントでは画像が404になることを確認する。三択写真・モザイク・回答結果の配置と操作が従来どおりか確認する。
5. source memory IDや別問題のchoice IDでは回答できないこと、確定後にだけ正解が返り、再送しても正解累計が増えないことを確認する。
6. 手紙を同じ本文で繰り返し保存して加算なし、非空の別本文で1加算、空本文・本文以外の変更・制約違反で加算なしを確認する。複数接続で同じ本文を同時保存した場合も1回だけか確認する。
7. ブラウザからletter_save_idの更新やsavedAlbumLettersのクライアントイベントを直接送っても拒否されることを確認する。

問題に表示する写真・本文から人が思い出して解答することや、本人が別の画面/APIで閲覧できる自分の写真データを照合することまで防止するものではありません。今回の対策は、回答前RPC・画像付帯情報に採点キーや機械的に照合できる内部対応表を漏らさず、サーバーに回答を確定させるためのものです。素材不足で選択肢が1個しか作れない既存仕様も変更していません。


### 今回の修正後の確認結果

- `npm run lint`：終了コード0、成功。
- `npm run build`：終了コード0、成功。Next.js 15.5.23のコンパイル・TypeScriptチェック・静的ページ生成・build tracesまで完了。
- 独立した型チェックコマンドは既存package.jsonになく、build内で確認しました。
- `git diff --check`：問題なし。TSX・CSS・package.json・lockfileは変更なし。buildによるnext-env.d.tsの生成差分は元に戻しました。
- 開始時の全28 migrationのハッシュと比較し、変更は未適用の `070210` のみ。新規migrationなし、version重複なし、適用済みの21本は変更なし。
- DBへの適用、DBテスト、npm test、E2E・ブラウザテストは未実行。SQL適用の成立性は依存定義とソースのレビューまでで、実DBでの成立を確認した意味ではありません。
