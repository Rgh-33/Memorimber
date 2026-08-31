# 氷・PETの反射・タピオカの追加調整

## 最新のロゴ・粒の見直し

単純なtextPathは廃止し、文字面を円錐台へ投影する方式へ変更。粒は光沢を抑えた6種類の画像とRGBAの透過用素材を使い、不均一な重なりに変更した。[使用素材・生成プロンプト・残る制約](issue-35-wordmark-pearls.md)を参照。

## 以前の再調整

- 帯状の光沢素材 `memory-tea-plastic-gloss.png` は撤去し、元のカップ写真に戻した。旧素材ファイルは履歴として残すが画面から参照しない。
- 氷は幅を固定し、液量と連動して縮まないようにした。上に出た部分と水中の部分を分け、水中側は不透明なミルクに隠れるよう表示を抑える。底では残った粒の上に留める。
- ロゴは細いサンセリフ体のまま、中央がわずかに下がるSVG textPathで曲面に沿わせる。月替わりの複数カップでもパス参照が重複しないようReact useIdを使用。
- タピオカを小さくし、7粒が底に自然に並ぶ縮尺へ変更。新素材の保存先は `public/images/memory-tea-pearl-in-milk.png`（1254×1254、RGBA）。内蔵ImageGenで1回生成し、アルファ透過と輪郭を素材単体で確認した。CLI/APIフォールバック・画像編集スクリプトは使用していない。

素材単体にはマクロ状の質感と光沢が残るため、完全な実写表現が確認できたとは扱わない。ユーザー承認後のブラウザ確認で、氷が透明余白ごと隠れすぎていた点を修正。画像内の水面位置を20%から46%へ変更（満杯では蓋の下に収める上限あり）し、水中側は下へ向かってミルクに消えるマスクにした。46%は撮影視点を含む画像上の位置で、氷の物理的な露出体積ではない。

新しい粒の最終プロンプト:

```text
Use case: photorealistic-natural
Asset type: one photographic transparent PNG cutout for a tiny approximately 20px boba element composited over a real milk-tea photograph.
Primary request: ONE ordinary small cooked black tapioca pearl as it is actually seen through the front clear PET wall of a milk-tea cup. Photograph the pearl in milky tea, not a standalone studio ball, then isolate only that pearl and its attached thin milky veil onto genuinely transparent RGBA.
Subject and material: soft gelatinous very dark near-black hydrated tapioca starch, sitting in creamy beige milk tea. Naturally uneven slightly flattened oval, lightly pressed against the clear cup wall. Smooth slightly translucent hydrated starch with a quiet subtly irregular surface, not exaggerated texture. Creamy beige milk wets and partially veils the perimeter and lower portion, softly obscuring its contour. The milky veil is attached to the pearl only, with a translucent tan antialiased edge, no detached milk pool.
Composition: near-frontal beverage-scale photographic appearance. Exactly one pearl centered, fully visible, occupying about 75–80 percent of the square canvas. It should read like a small real boba seen inside an everyday drink, not a giant macro object.
Lighting: natural soft ambient daylight, subdued SMALL diffuse reflection from upper-left, low-contrast and visually quiet, milk-softened appearance. No hard highlight, no big shiny glossy patch, no studio lighting.
Output: true RGBA PNG with alpha=0 outside the irregular pearl-and-attached-milk outline. Preserve partial alpha along soft translucent tan edges. The background must be actual transparency, not white, black, colored, or a drawn checkerboard.
Avoid: any second pearl; cup outline or edges; straw; ice; text; watermark; background; checkerboard; ground plane; detached shadow; detached milk puddle; illustration; CGI; 3D render; designed glossy blob; perfectly spherical gradient; marble; chocolate truffle; leather skin; ridges; cracked or wrinkled skin; candy finish; exaggerated macro texture.
```

## 以前の調整の記録

内蔵ImageGenを使用。CLI/APIフォールバックは使用していない。以下の生成出力をそのままコピーし、画像編集用スクリプトは使用していない。

| 保存先（public/images/） | 形式 | 用途 |
| --- | --- | --- |
| memory-tea-plastic-gloss.png | 1024×1536 RGB | ミルク部分に見えるPETの反射。元のカップ写真のアルファでマスクする |
| memory-tea-ice.png | 2172×724 RGBA | 液面に追従する氷4個の写真 |
| memory-tea-pearl-shape.png | 1254×1254 RGBA | 粒の輪郭のアルファマスク |
| memory-tea-pearl-soft.png | 1254×1254 RGB | 光沢を抑えたタピオカ。上の輪郭でマスクする |

カップと粒の編集結果は背景透過が失われたため、単独で表示しない。`tea-gloss-photo` と `tea-pearl` のCSSマスクで元の写真のアルファを使用する。カップの編集はミルク部分だけに重ね、透明な蓋・ストローは元の画像を維持する。マスクの適用は回帰テストで確認する。RGBAの氷はそのまま使用する。

印字は画像に焼き込まず、上寄り（画像高の49%）・300ウェイトの細いサンセリフ体で描画する。タピオカは大きさと位置を少し変え、手前にミルクの薄い層とPETの反射を重ねる。

## カップのPET反射 — 最終プロンプト

編集対象: `public/images/memory-tea-plastic-full.png`

```text
Use case: precise-object-edit
Asset type: photorealistic transparent PNG base cup for a layered milk-tea UI.
Input images: Image 1 is the EDIT TARGET, preserve its geometry and registration exactly.
Primary request: Change only the appearance of the transparent PET PLASTIC WALL in front of the milk tea so that it clearly reads as a real glossy thin plastic cup, instead of the current matte-paper or ceramic-looking tea area.
Composition/framing invariants: Keep the exact 1024x1536 canvas, exact cup silhouette, position, size, taper and bottom, exact flat clear snap-on lid and black straw position/angle, original slight downward viewing angle, and continuous opaque creamy tan milk tea all the way to the bottom. Keep original light and tea color.
Materials: Photograph of a real clear thin PET cold-drink cup. Add restrained curved vertical reflected window strips across the transparent wall in front of the tea, a thin glossy clear PET boundary, subtle molded bends and authentic sparse condensation droplets. Reflections should show that a clear layer sits in FRONT of the tea without becoming mirrorlike metal. The wall should feel flexible and very thin, with small natural variations, not glassware, ceramic or paper. Premium natural cafe product photography, subtly imperfect real surfaces, no CGI or illustration.
Transparency: Deliver a true RGBA PNG with genuinely transparent background. Every pixel outside the physical cup/lid/straw silhouette must have alpha 0, including the soft external glow visible around the input; do not preserve that glow. No black, white, gray, checkerboard or any other baked backdrop. Tea inside the cup remains opaque; do not make the tea see-through. Clean antialiased product cutout edges.
Constraints: No pearls or boba baked into the cup. No ice. No text, logo, watermark, setting, floor, external cast shadow or background. Do not alter composition, lighting, straw, lid shape or milk tea level. The single change is realistic visible glossy thin PET wall around the same drink.
```

## 氷 — 最終プロンプト

```text
Use case: product-mockup
Asset type: photorealistic transparent PNG ice cluster overlay for the liquid surface inside a creamy tan milk-tea cup.
Primary request: ONE low-profile horizontal cluster of 4–5 real partially melted ice cubes with genuine transparent RGBA background.
Composition/framing: Landscape 1536x512 canvas. Entire cluster approximately 3:1 width-to-height, filling the central width with a modest clear margin. Camera almost front-on, looking slightly down, showing slim top faces and wet front faces. Not a top-down photograph. Cubes gather loosely in a single low cluster, not a tall pyramid, each imperfectly rotated and differently softened.
Materials/textures: Real clear translucent WATER ICE with irregular softened square edges, subtle natural tiny cracks and very sparse trapped air bubbles. Slightly creamy TAN milk-tea wet coating on lower halves and thin tea-tinted melting edges, with naturally clear upper halves. Restrained diffuse window reflections from upper left. Intimate real beverage product photography, plausibly small wet food-scale objects. Soft high-detail realism, not polished crystals, glass gems or illustration.
Transparency: True RGBA background, alpha 0 outside the physical ice cutout contours, clean antialiased edges, natural varying translucency inside the clear ice. No fake checkerboard. Transparent gaps between ice pieces remain transparent.
Constraints: No bright blue. No large liquid pool, no cup, no straw, no other object, no text, no logo, no cast shadow, no floor, no backdrop, no outlines, no CGI look. A single cluster only. Should remain natural when scaled to 50–200 CSS pixels wide in a milk-tea UI; lower cube edges lightly tan for integration.
```

## タピオカの輪郭 — 最終プロンプト

```text
Use case: product-mockup
Asset type: photorealistic transparent PNG single cooked tapioca pearl overlay inside a milk-tea cup.
Primary request: ONE real small soft freshly cooked black tapioca pearl, as seen through creamy milky tea and thin clear PET; a genuine photographic food cutout, not a shiny hard chocolate ball, marble, icon or 3D render.
Composition/framing: Square 1024x1024 canvas. One slightly squashed organic smooth rounded boba pearl fills approximately 80% of the canvas, centered. Silhouette softly asymmetric, never sphere-perfect, but smooth with no ridges or wrinkles. Near-front view with a little of the upper surface visible.
Materials/textures: Soft cooked gelatinous tapioca, deep translucent brown-black, naturally smooth hydrated starch skin with tiny fine subtle starch imperfections. Thin translucent tan milk-tea coating at the perimeter. Muted realistic broad upper-left soft light: one subdued, broad, low-contrast highlight that never approaches a sharp white specular blob. Very gentle tonal depth; food-soft and slightly translucent, not chocolate texture, leather, stone or plastic.
Transparency: True RGBA PNG with alpha 0 outside the pearl silhouette and clean antialiased cutout edge. No baked black, white, gray, checkerboard or background. Preserve delicate translucency just at the tan-coated perimeter.
Constraints: Only one pearl. No pool, no cup, no other object, no external cast shadow, no text, no watermark. No sharp bright white highlights, no wrinkles, no ridges, no cracks, no pearl seam, no glass-globe look, no sphere-perfect silhouette, no illustration or CGI. It must read as real soft cooked boba when displayed small, not a glossy candy.
```

## タピオカの控えめな光沢 — 最終プロンプト

編集対象: 上のRGBAタピオカ写真。

```text
Use case: lighting-weather
Input image: EDIT TARGET, one cooked tapioca pearl on transparent background.
Primary request: Change ONLY the lighting and optical appearance so this soft cooked boba seen through milky tea is deep brown-black with a subdued broad LOW-CONTRAST highlight, rather than hard glossy chocolate or glass.
Remove the large sharply bounded pale gray-white reflection on its upper-left face and every sharp white specular patch. Replace with an extremely soft broad gradual dark-warm-brown lift, only slightly brighter than the body, like diffuse daylight through milky liquid and polarizing photographic lighting. Keep it hydrated and softly gelatinous, not dry matte leather. Reduce the bright tan coating to a thin softly translucent warm-tan perimeter. No ridges, wrinkles or cracks.
Preserve the single slightly squashed organic smooth rounded shape, centered placement and photographic micro-detail, with no new objects. Deep translucent brown-black body. Near-front view. Genuine transparent RGBA background, alpha zero outside silhouette, no backdrop, no checkerboard, no pool or external shadow. No text or watermark. The result must feel like small soft cooked tapioca suspended in creamy milk tea, not a hard shiny candy. Keep the background genuinely transparent.
```
