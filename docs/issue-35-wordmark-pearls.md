# ロゴの投影と粒の見直し — 2026-08-31

対象は `feature/issue-35-tapiokaan` の作業ツリーのみ。mainや他ブランチの参照は変更しない。

## ロゴ

単純な弧へ文字を配置するtextPathを廃止。`tea-wordmark-geometry.ts` で、カップの円錐台の細まり（0.12）と見下ろし角度（8度）を用いて文字面を投影する。単語を一度組版してから72の細片で変形し、文字の横幅の圧縮・縦線の傾き・奥行きを連続させる。投影値は小数6桁で揃え、Nodeとブラウザの三角関数の末尾差によるhydrationエラーを防ぐ。

## 粒

内蔵ImageGenを使用。CLI/APIフォールバックや画像編集スクリプトは使用していない。採用画像は生成出力をそのままコピーした。

| ファイル | 形式 | 使用方法 |
| --- | --- | --- |
| `public/images/memory-tea-pearls-alpha.png` | 1536×1024 RGBA | 最初の6粒の画像を透過用マスクとして使用 |
| `public/images/memory-tea-pearls-muted.png` | 1536×1024 RGB | 表面の反射を抑える編集結果。必ず上記マスクと組み合わせる |

初回素材には強い白い反射が残ったため、その色は画面に使わない。編集結果は光沢が弱まった一方で透明背景が失われ、チェック模様が焼き込まれた。RGB画像を単体で表示せず、同寸の初回RGBA画像をCSSのアルファマスクとして使う。3列×2行の切り出し位置を色・マスクで一致させ、記憶IDごとに表面を固定する。前後の重なりとミルクによる減衰も付ける。

素材のマクロ的な質感、輪郭の微細な透過成分、編集前後のごく小さな形状差は限界として残る。完全な実写品質を達成したとは扱わない。別の短いプロンプトでも新規生成を1回試したが、光沢が強いため不採用とし、プロジェクトへコピーしていない。

## 採用素材の最終プロンプト

### 透過用の6粒

```text
Use case: photorealistic-natural
Asset type: ONE transparent photographic sprite sheet of six cooked black tapioca pearls, for one small animated pearl per memory inside a photographic clear PET milk-tea cup. This is a real-food cutout asset, not an illustration or icon set.

Scene/backdrop: Genuinely transparent RGBA outside the pearls. Photograph the food as if seen through a clear cup front and a very thin layer of beige milky tea, but DO NOT include the cup itself or any background. Preserve clean semitransparent tan antialiased edges, with no baked background or checkerboard.

Subject: Six independent ordinary cooked boba pearls with dark brown-black bodies. Each pearl is subtly different in naturally flattened oval shape, orientation, and amount of attached milky edge coverage; do not repeat or clone a pearl. Similar overall sizes. Smooth hydrated gelatinized starch with a soft, yielding food appearance, quiet low-contrast reflections and delicate translucency at thin edges. A restrained creamy tea film clings to portions of each contour. Matte milky occlusion makes some parts of the dark contour disappear softly. The milk film is attached to the pearl, never a detached puddle.

Composition/framing: Landscape 3:2 canvas, intended 1536 by 1024 pixels. Strict 3-column by 2-row sheet of six equal square cells, with one pearl centered in every cell. Exact centers are at columns 1/6, 1/2, 5/6 of full image width, and rows 1/4, 3/4 of full image height; equivalently centers (256,256), (768,256), (1280,256), (256,768), (768,768), (1280,768) on a 1536x1024 canvas. Each pearl occupies approximately 70% of its cell width, with at least 15% clear transparent padding on each side. Every pearl and its attached milk film stay fully inside its cell. No drawn cell boundaries. Near-frontal camera, slightly above, consistent across all six pearls.

Style/medium: Photorealistic unretouched real-food photography. Natural imperfections are gentle variations in cooked shape, not rough surface texture. The pearls must look natural when reduced to 18–22 CSS pixels.

Lighting: Consistent soft diffuse upper-left cafe daylight. Low contrast, subdued reflections, no artificial dramatic polish.

Avoid: Chocolate truffles, rough leather, raisins, pebbles, glass balls, polished marbles, perfect spheres, designed spherical gradients, faceted geometry, radial painted shine, bright white highlights, hard outlines, cracks, wrinkles, exaggerated macro texture, illustration, 3D-render appearance. No cup, ice, straw, ground, external cast shadow, detached liquid, text, labels, cell lines, logos, watermark, or any other objects.

Output: Exactly ONE cohesive transparent image containing six clearly distinct but similarly sized natural cooked tapioca pearls, in the exact aligned 3-by-2 grid.
```

### 表面の反射を抑える編集

```text
Use case: precise-object-edit
Input images: Image 1 is the edit target, a six-pearl 1536x1024 transparent sprite sheet.

Primary request: Change ONLY the pearls' surface, lighting, and edge treatment. Make these genuinely SMOOTH, soft hydrated cooked tapioca pearls. The surface is extremely dark warm black with only a faint diffuse tonal lift, never a shiny patch. Photograph with cross-polarized diffuse lighting to completely suppress specular reflections. Remove every bright white reflection and pale highlight patch. Remove all visible bumpy, leathery, wrinkled, rind-like, grainy, or dramatic texture. The result must suggest ordinary soft gelatinized cooked starch seen through a thin layer of milky tea, not chocolate, leather, rocks, glass, polished marbles, or artificial rendered spheres.

Edge treatment: Replace the thick beige rims with a THIN, soft attached translucent tea edge, irregularly present on portions of each existing contour. Eliminate every broad halo, glow, cloudy surround, detached liquid patch, and external shadow. Genuinely transparent RGBA output: alpha must be exactly zero everywhere outside the six pearl silhouettes, with only clean semitransparent antialiasing immediately along the silhouette edges. Do not bake in any background or checkerboard.

Invariants: Keep exactly the existing 1536x1024 canvas, three-column by two-row grid, six distinct silhouettes, size, orientation, centers, spacing, and arrangement. Keep every pearl separate and inside its existing cell. Keep the near-frontal slightly-above camera angle. Do not add, remove, duplicate, reposition, or reshape pearls. No new objects, cup, ice, straw, background, ground, text, labels, lines, or watermark. This is a targeted photographic surface-and-lighting correction, not a new composition.
```

## 接続先

3100は一時プレビュー起動時にこちらが指定した番号だった。3000の競合は確認されておらず、ユーザーへの説明も不足していた。現在はプレビューを標準の `http://localhost:3000/` に戻した。ポート間でブラウザ保存データの移動・削除は行わない。環境ファイル・認証・依存関係・クイズロジックは変更しない。

## 検証

`npm test` の54件と `npm run build` が成功。生成先を分離した開発サーバーはビルド中も起動を維持。アプリ内ブラウザでライト／ダークの表示、ロゴの描画、粒の重なり、カップの操作ダイアログを確認した。Firefox本体は操作しておらず、Firefoxでの目視検証済みとはしない。
