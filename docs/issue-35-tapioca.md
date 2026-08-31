# Issue 35 — タピオカ案の試作

対象は `feature/issue-35-tapiokaan` のみ。他ブランチのコミット、Supabaseのスキーマ、Storage、認証設定、環境ファイル、依存関係は変更しない。

## 試し方

通常は `npm run dev`、接続先は `http://localhost:3000/`。一時的なプレビュー用に3100を指定していたが、3000に戻した。Supabase接続時は従来どおりログインする。

ホームのカップ下、または「設定 → ミルクティー」のプレビューを開く。

1. 「サンプルのカップを開く」（Supabase未設定なら最初からサンプル）。
2. 「ひと粒を追加」で投入を確認する。写真やDBは書き換えない。
3. ホームへ戻り、カップ自体をタップする。開いたダイアログの「飲む」からクイズへ。
4. 回答を確定してホームへ戻る。粒がストローに吸い上がり、お茶が減り、言葉が漂う。
5. 浮かんだ言葉は従来どおり長押しして移動、12回分揺らして関連写真を表示。キーボードならEnterで表示。
6. 「次の月へ」で月替わりを確認。余ったお茶を見送り、未回答の粒を次のカップへ移す。
7. 「設定 → スタイル」でライト・ダークと6色を切り替える。透明なプラスチックの反射、お茶の色、ロゴの色が追従。
8. 「試作をリセット」はサンプルだけを初期状態へ戻す。

## この案での仕様

- ホームの見出しはmainと同じ「MEMORIES」「あなたの思い出」「何気ない一日を、未来の自分へ。」を維持。木だけをカップに置き換える。
- ホームに追加の説明、飲みごろ表示、数値インジケータ、CTAを置かない。飲む操作と読み込み・保存状態の説明はカップをタップしたダイアログ内だけで表示する。
- 試作用のプレビュー操作だけはカップ下に折りたたんで配置する。カップのロゴは上寄りに細いサンセリフ体で印字。単純なtextPathは廃止し、組版した単語を72の細片に分けてテーパー付きの曲面へ投影する。文字端の圧縮・縦線の傾き・奥行きを同じ面から計算。複数カップのSVG参照はuseIdで分離し、変換行列は6桁に丸めてブラウザとサーバーの浮動小数点差によるhydrationエラーを防ぐ。
- 氷の大きさは液量で変えない。写真の透明余白と斜めの上面を考慮し、上面だけが液面にのぞく位置に置く。沈んだ部分はミルクの中へ徐々に消える。底に達したら残った粒の上に留まる。タピオカはミルクが輪郭にかかった写真を約20pxの不均一な大きさ・配置で並べる。
- 前回の帯状の光沢画像は使わず、元の写真の反射とごく薄いPETの層だけにする。
- 待機キューは7件。最初の7枚では回答できず、8枚目で最古の1件が解放される。
- 以後、追加1枚につき1件が飲みごろになる。飲みごろの未回答分も無制限に保持し、回答は必ずFIFO。
- 順番には投稿日時 `created_at` を使用。写真の日付を過去に設定しても、キューに割り込まない。
- 保存リトライ・再読込・URL更新で同じ思い出の粒を重複追加しない。
- 回答確定で1粒を消費。正誤に関係なくお茶が1/15減り、正解数のみ別途集計。
- 15回答で液量はゼロ。それ以上もクイズ可能で、液量は負にならない。
- 月の判定はブラウザのローカル年月。起動時、フォーカス復帰、表示復帰、30秒周期、回答時に確認。
- 月替わりは待機粒・飲みごろの未回答粒・回答済み記録・浮かぶ言葉を維持。お茶だけを満タンへ戻す。演出は確認するまで保持。
- 数か月未訪問でも粒は失わない。時計が後退しても過去月へ戻さない。
- 混雑時のカップには代表14粒（最古の1粒と最新13粒）を表示し、データは全件保持する。件数は表示しない。言葉の同時表示は最新12件。
- 浮かぶ言葉は、月名を除く最初のタグ、タグがなければ一言の先頭10文字。新しいAI解析や命名フローは追加していない。
- クイズは既存のサンプル問題を保持し、その他の写真には撮影月の3択問題を用意。
- `prefers-reduced-motion` では演出を省き、結果は同じ。月替わりはネイティブdialogのフォーカス制御とEscapeに対応。

## 保存の境界

写真は従来どおりSupabaseの非公開StorageとDBへ保存する。追加変更は読み取りに `created_at` と本人IDを含めることのみ。アップロード、復旧、削除処理は変更しない。

タピオカの進行は**このブランチの端末ローカル試作**。`memorimber-tapioca-v1:<userId>` に思い出ID・回答の年月と正誤・キュー・月替わり通知だけを保存。写真・本文・署名URL・認証情報は保存しない。ユーザー切替時はコンテキストを作り直す。サンプルは `memorimber-tapioca-preview-v1` に完全分離。ブラウザのデータを消すとクイズ進行はリセットされるが、写真は消えない。

別端末との同期や、複数タブで完全に同時に更新する際のトランザクション保証はない。本採用時は回答履歴とキューのDB化・RLSを別途設計する。

プロフィールのレベル要件・閾値・内部メトリクス・メダルIDは互換性のため維持。表示のみ「味わう」「思い出のテイスター」へ。クイズと粒の件数はローカル進行から算出し、既存のレベル到達時基準・共有・友達クイズの仮データはそのまま。

## 実装と検証

- `lib/tea-state.ts`: DOMから独立したキュー、月替わり、液量、復元のロジック。
- `lib/tea-context.tsx`: 写真との接続、アカウント分離、ローカル保存、サンプル操作。
- `components/tea-cup.tsx`: プラスチック容器入りミルクティーの写真、空の容器、タピオカ写真、ロゴを合成。容器全体が操作対象。
- `lib/tea-cup-geometry.ts`: テーパー付き容器の体積から液面を計算。底まで入った写真の上端だけをマスクし、液体と底の間に透明な隙間を作らない。
- `components/memory-words.tsx`: 旧memory-treeから単語の操作を引き継いだコンポーネント。
- `app/tea.css`: ライト・ダークの素材感、投入・吸い上げ・月替わり。
- `tests/tea.test.mjs`: キュー境界、二重回答、誤答、15回、年越し、未訪問、破損状態、240回の操作列、レベル互換。
- `tests/tea-ui.test.mjs`: 元のホーム文言、プレビュー以外の追加操作がないこと、プレビューの位置、カップのタップ操作、15段階の液面・氷の位置、写真のアルファマスクを検証。
- `npm test` の48件と `npm run build` が成功。2026-08-31、ユーザー承認のうえCodex内ブラウザのサンプルで満杯・7回答後（残量8/15）・15回答後（空）をライト／ダーク両方で目視確認した。氷の上面が隠れすぎる位置を修正し、液面への追従と空の底に残る粒・氷を確認。サンプルの月替わりで未回答7粒が引き継がれる表示も確認。実Supabaseへの投稿や実端末での検証は行っていない。

## ローカルプレビューの接続エラー対策

2026-08-31のログで、開発サーバーを起動したまま本番ビルドを行った際に、共用していた `.next/routes-manifest.json` が欠落し、ホームが500エラーになったことを確認。再起動後のサーバーは正常応答していたが、2つあるブラウザタブの一方には旧版の画面も残っていた。

`next.config.mjs` で開発時のみ `.next-dev/` を使用し、ビルド・本番起動は標準の `.next/` を維持するよう分離した。生成物は両方Git管理外にし、TypeScriptの型読み込み先と回帰テストも追加。環境ファイル・Supabase・画面の文言やデザインは変更していない。既存タブは再読み込みで最新表示に更新する。

## 生成素材

現在使用する素材は内蔵ImageGenで生成した透明PNG。生成時のアルファを維持し、外周の透過・ミルクティーが底まで満たされていることを素材単体で確認した。

- `public/images/memory-tea-plastic-full.png` — 1024×1536 RGBA、ミルクティー入りPET容器。液量表示の主素材。
- `public/images/memory-tea-plastic-empty.png` — 1024×1536 RGBA、空のPET容器。液面より上の部分に使用し、縦位置と倍率をコードで合わせる。
- `public/images/memory-tea-pearl.png` — 1254×1254 RGBA、単体のタピオカ。粒ごとの位置・投入・吸い上げだけをコードで制御。

現行の追加素材は `memory-tea-ice.png`、6種類の粒を含む `memory-tea-pearls-muted.png` と透過用の `memory-tea-pearls-alpha.png`。RGBの粒素材は同寸のRGBA素材をCSSマスクに使い、単体表示しない。記憶IDごとに表面を固定し、底の前後・不均一な重なり・ミルクによる減衰を表現する。生成素材には質感の限界が残るため、完全な実写品質を達成したとは扱わない。過去の素材は履歴として保持するが画面から参照しない。

使用した最終プロンプトは [素材の生成記録](issue-35-tapioca-assets.md) に記録。以下のガラス素材は旧案の履歴として残すが、画面からは参照しない。

旧ガラス素材 `public/images/memory-tea-glass.png` のプロンプト:

```text
Use case: product-mockup
Asset type: transparent raster overlay for a premium Tokyo tea boutique UI; dynamic tea and pearls will be placed underneath this layer.
Primary request: a single EMPTY, perfectly clear tall glass tumbler with a slender warm translucent smoky straw on the RIGHT. Nothing is inside the glass except the straw.
Style/medium: exquisite photorealistic contemporary editorial product photography, premium and understated. Realistic thin glass edge reflections, delicate sparse condensation beads, restrained soft studio illumination. No cartoon, illustration, stylized 3D, chrome, silver glamour, or exaggerated glow.
Composition/framing: portrait 1024x1536 PNG if possible. Straight-on camera with a slight view into the elliptical open rim. Entire object visible and centered, no cropping. Slightly tapered tumbler: rim approximately at 23% of image height, spanning x22% to x78%; flat-bottomed gently rounded base at y92%, spanning x28% to x72%. Straw leans subtly to the right, upper tip at x70%, y3%, extending down inside the glass nearly to the base.
Scene/backdrop: TRUE TRANSPARENT background, RGBA PNG with actual alpha. Isolated glass and straw only, no floor, no backdrop, no cast shadow outside the object, no background checkerboard baked into pixels.
Critical transparency requirement: the interior of the empty tumbler must remain genuinely alpha-transparent, not opaque white or gray. Only the rim, glass edges, base thickness, faint reflections and condensation should contribute semi-transparent pixels. This glass is an overlay: arbitrary colored liquid behind it must show through clearly.
Constraints: NO liquid, NO tea, NO water, NO pearls, NO ice, NO text, NO lettering, NO logo, NO label, NO watermark. One glass and one straw only. Preserve a refined warm neutral tone in reflections and straw without tinting the transparent empty interior.
```
