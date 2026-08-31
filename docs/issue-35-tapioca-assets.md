# プラスチックカップ素材の生成記録

内蔵ImageGenを使用。CLI/APIフォールバックは使用していない。生成されたRGBA PNGをそのままプロジェクトへコピーし、外周のアルファ透過を確認した。位置合わせ、液量マスク、印字、粒の動き、テーマ別の色調はCSS/Reactで制御する。

氷・PETの光沢・タピオカの光沢を調整した現行の追加素材とプロンプトは [追加調整の生成記録](issue-35-tapioca-materials.md) を参照。以下は継続使用する基礎素材と旧粒素材の生成記録。

## ミルクティー入りカップ

保存先: `public/images/memory-tea-plastic-full.png`（1024×1536）

```text
Use case: product-mockup
Asset type: photorealistic full-drink image for an interactive bubble-tea boutique UI. Portrait 1024x1536 RGBA PNG.
Scene/backdrop: genuinely transparent alpha background. Isolate ONE drink cup with its lid and straw, no floor, no props, no exterior cast shadow, no painted checkerboard.
Subject: understated premium Taiwanese/Japanese takeaway bubble tea in a thin, clear, flexible PET PLASTIC CUP. Medium-wide tapered takeaway shape, recognizable molded plastic, thin rolled rim, flat clear plastic snap lid with delicate concentric circumferential rings. Broad matte smoky-dark boba straw angled toward the upper RIGHT. This is NOT a glass tumbler: no thick glass walls, no heavy base, no chrome highlights.
Drink: smooth creamy tan black-tea milk, nearly full from approximately image y28% all the way down to y93%. Natural quiet beige/tan hue with gentle photographic modeling, mostly uniform, NOT orange, NOT vertical ombre. Milk tea MUST fill continuously to the very bottom of the thin plastic container with absolutely no empty white or clear gap between the liquid and base. The milk-filled interior must be fully opaque; only the surrounding backdrop and clear plastic above the liquid are transparent.
Composition/framing: almost front-on camera, slight elliptical view of lid and base, entire object centered and visible without cropping. Requested cup bounds: lid/rim from x18% to x82% at about y22%; tapered base from x28% to x72% at y95%. Straw upper tip near x70%, y4%, entering lid on its right side. Realistic contemporary takeaway cup proportions.
Style/medium: photographic realism, quiet premium product editorial, soft natural light, cool fine condensation droplets clinging to the plastic; subtle delicate reflections and realistic thin plastic molding. Not cartoon, illustration, CGI-looking, glass, silver glamour, or metallic.
Constraints: NO boba pearls, NO tapioca, NO ice, NO chunks, NO foam cap, NO logo, NO text, NO lettering, NO label, NO watermark. The interactive app will add pearls and lettering. One full milk-tea cup, one lid, one straw only. Actual transparent PNG background, opaque milk inside.
```

## 空のカップ

保存先: `public/images/memory-tea-plastic-empty.png`（1024×1536）

同一画像のピクセル単位の編集ではなく、空の容器として別生成した素材。カップの上部には満杯素材の蓋とストローを固定表示し、空の部分だけをマスクで表示する。空素材の縦位置と高さをコードで調整している。

```text
Use case: product-mockup
Asset type: empty takeaway cup transparent overlay for a premium Japanese/Taiwanese bubble tea UI, portrait 1024x1536 RGBA PNG.
Scene/backdrop: TRUE TRANSPARENT ALPHA background. There is no scene, no ground, no floor, no backdrop, no outside shadow. Only the isolated plastic cup, lid and straw.
Subject: one completely EMPTY clear thin flexible PET PLASTIC takeaway drink cup with medium-wide tapered walls, a thin rolled rim, flat clear plastic snap lid with subtle concentric circumferential rings, and a broad matte smoky-dark black boba straw angled to upper right and continuing inside to the bottom. The cup is molded thin plastic, unmistakably disposable takeaway plastic, NOT glass. No thick walls or heavy base. Sparse light fine condensation on outside, soft delicate plastic reflections.
Precise composition geometry on the 1024x1536 canvas: object centered at x50%, fixed full view no crop. Straw top at x70%, y2%; straw runs diagonally down-left through lid's right half to near x45%, y92%. Flat elliptical lid spans x15.5% to84.5%, and y23% to32%. Cup body tapered outer edges at y36% x21–79%; y52% x24–76%; y78% x28–72%; y91% x31–69%. Thin gently rounded bottom reaches y96%. Almost front-on camera with a slight view of lid ellipse and base ellipse.
Materials and photography: understated premium editorial product photography, soft natural diffuse light from upper left, realistic slightly flexible molded PET plastic with faint gray-neutral edge reflections, quiet restrained contrast, subtle fine cool condensation. No glass tumbler, no mirror edges, no chrome, no cartoon or illustration, no silver glam.
CRITICAL: the inside is EMPTY and actually TRANSPARENT ALPHA, not filled white, gray or black. Only the plastic edges, delicate reflections, condensation, lid and dark straw contribute visible pixels. Interior clear areas should be nearly invisible in the alpha channel so any colored liquid layer behind this image will show through naturally. Preserve genuine transparency inside and outside the cup in an RGBA PNG. Do not draw a checkerboard grid or any opaque background color.
Constraints: NO liquid, NO milk, NO tea, NO pearls, NO ice, NO labels, NO text, NO logo, NO watermark. Single empty plastic cup with one lid and one wide dark straw only.
```

## タピオカの粒

保存先: `public/images/memory-tea-pearl.png`（1254×1254）

```text
Use case: product-mockup.
Asset type: a single photographic tapioca pearl cutout for an interactive premium bubble-tea UI, square 1024x1024 RGBA PNG.
Scene/backdrop: TRUE transparent alpha background, isolated single object with no floor, no backdrop, no cast shadow outside the object.
Subject: exactly ONE cooked black tapioca pearl. Subtly irregular rounded sphere, realistic soft gelatinous starch, deep dark brown-black with a very thin natural creamy tan milk-tea coating. It should unmistakably look like one real edible cooked boba pearl, not a bead, marble, metal ball, chocolate truffle, or icon. Fine naturally imperfect soft wet surface, restrained and photographic.
Lighting: soft natural editorial product light from upper-left, one broad diffuse muted highlight, gentle shadow modeling toward bottom-right; no brilliant gloss, no chrome reflections, no stylized shine, no cartoon highlights.
Composition: one centered pearl filling roughly 75 percent of the square frame, entire natural outline visible and generous transparent border. Close macro photograph in crisp focus, subtle organic surface detail.
Constraints: only ONE pearl, no other pearls, no clusters, no liquid pool, no drips hanging outside it, no bubbles, no cup, no straw, no floor shadow, no text, no lettering, no logos, no watermark. Actual alpha transparency outside the pearl; the pearl itself opaque. No checkerboard painted in pixels. Photorealistic, not illustration or CGI.
```
