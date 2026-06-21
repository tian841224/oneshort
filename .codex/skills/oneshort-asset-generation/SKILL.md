---
name: oneshort-asset-generation
description: Use when generating, commissioning, editing, or reviewing OneShort visual assets such as job/class avatars, party thumbnails, scene banners, empty-state illustrations, guild emblems, boss thumbnails, and status icons.
---

# OneShort Asset Generation

Use this skill for bitmap or illustration assets that create OneShort's warm MMORPG atmosphere. It covers generation, editing, review, naming, and placement of visual assets. For UI layout, component styling, typography, copy, and responsive behavior, follow `.agent/rules/style.md` instead.

## Boundary

- Assets support the UI; they must not replace UI structure or operational data.
- Do not bake Traditional Chinese labels, status text, numbers, room codes, or instructions into images.
- Render all product copy as real HTML text.
- Do not use copyrighted Artale assets or recognizable copied game artwork.
- Functional UI icons still come from `lucide-react`; generated assets are for game context only.
- If a request is about component layout, CSS, copy, navigation, or responsive behavior, use `style.md`; use this skill only for the image asset itself.

## Visual Direction

OneShort assets should feel like a premium MMORPG SaaS workspace: warm, calm, cozy, useful, and softly game-aware.

Use:
- warm beige, cream, muted brown, soft olive, muted gold, and muted terracotta
- low saturation
- polished 2D chibi fantasy, subtle pixel-art, or clean warm pictogram style
- crisp silhouettes readable in product UI
- gentle scene storytelling with one clear focal point

Avoid:
- cyberpunk, neon, RGB, dark sci-fi, glassmorphism, gacha splash art
- realistic 3D rendering
- noisy battle scenes or action chaos
- high-saturation blue, cyan, purple, green, or red as dominant colors

## Workflow

1. Identify the asset slot: avatar, thumbnail, banner, empty state, emblem, boss image, or status icon.
2. Confirm where it appears in the UI and the target size or aspect ratio.
3. Select the matching asset type below and use its required composition rules.
4. Generate or edit the asset with the shared visual direction and prompt template.
5. Review the asset against the checklist before adding it to the repo.
6. Name the file with lowercase kebab-case that describes the semantic use, not the prompt wording.
7. Place approved assets under the matching frontend path:
   - `frontend/public/assets/jobs/`
   - `frontend/public/assets/scenes/`
   - `frontend/public/assets/thumbnails/`
   - `frontend/public/assets/empty/`
   - `frontend/public/assets/status/`
   - `frontend/public/assets/guilds/`
   - `frontend/public/assets/bosses/`
8. Verify the asset in the actual UI size, including mobile density and dark text contrast around it.

## Naming And Format

- Use lowercase kebab-case: `bishop-avatar.webp`, `chaos-boss-thumbnail.webp`, `empty-party-board.png`.
- Prefer semantic names tied to UI usage over model-output names.
- Do not include version chatter such as `final`, `new`, `v2`, or prompt fragments.
- Icons and avatars: `webp` or transparent `png`.
- Simple status icons: `svg` when drawn as a simple pictogram.
- Scene banners, large backgrounds, and thumbnails: `webp`.
- Keep source/export metadata out of committed assets unless it is intentionally used by the build.

## Asset Types

### Job Or Class Avatar

- Centered character bust or simple full-body silhouette.
- Circular cream or beige background.
- Thin warm brown outline ring.
- Transparent outside the circle.
- Consistent padding, outline thickness, and visual weight across all jobs.
- Readable at 48x48 px.
- No complex background.
- No text, letters, numbers, skill names, or job labels inside the icon.

### Scene Banner

- Use for login, onboarding, guild identity, detail headers, or atmospheric page sections.
- Leave quiet empty space on one side for UI overlays.
- Keep the focal point off-center.
- Use 16:9, 3:1, or the exact product slot ratio.
- Avoid clutter behind text and controls.

### Party Thumbnail

- Use a compact scene or 3-5 character group.
- Make the party type recognizable at card size.
- Prefer warm composition and readable silhouettes over detailed action.
- Keep a stable aspect ratio across party cards.

### Empty State Illustration

- Small calm object or scene: notice board, quiet guild hall, mushroom sign, campfire, map table.
- No dramatic sadness or large fantasy poster treatment.
- Must support one short UI message and one clear action beside it.

### Guild Emblem Or Banner

- Emblems should read as simple symbols at small size.
- Banners may include fabric, crest, hall, or gathering cues.
- Avoid ornate frames that make the dashboard feel like a game launcher.

### Boss Thumbnail

- Show a simplified boss silhouette or themed environment cue.
- Avoid copying official boss art.
- Keep it decorative and contextual; the target name remains real UI text.

### Status Icon

- Use simple SVG or small pictogram treatment.
- Do not rely on color alone; pair with a text status label in UI.
- Keep stroke/fill weight consistent with nearby interface icons.

## Review Checklist

- Asset matches the target slot and aspect ratio.
- It is readable at the actual rendered size.
- It uses warm, low-saturation OneShort colors.
- It does not contain UI text, status words, counts, or room information.
- It does not copy official Artale/game artwork.
- It does not look cyberpunk, neon, RGB, dark sci-fi, glossy, or realistic 3D.
- It does not compete with forms, tables, chat, or dense dashboard data.
- Banners leave enough quiet space for real HTML overlays.
- Avatars and status icons have consistent visual weight across the set.

## Prompt Building Blocks

Core style:

```text
Warm cozy fantasy MMORPG utility UI, premium SaaS dashboard asset, low saturation, warm beige and muted brown palette, soft olive and muted gold accents, polished 2D chibi fantasy style, crisp readable silhouette, calm composition, no text in image.
```

Negative constraints:

```text
No cyberpunk, no neon, no RGB, no dark sci-fi, no glassmorphism, no realistic 3D render, no copied game artwork, no UI text, no logo text, no high-saturation colors, no chaotic battle scene.
```

## Prompt Templates

### Character / Class Avatar Icon

```text
Generate a fantasy MMORPG job/class avatar icon for OneShort.

Style: warm cozy fantasy MMORPG utility UI, premium SaaS dashboard asset, polished 2D chibi fantasy style.
Composition: centered character, circular cream background, thin warm brown outline ring, transparent outside the circle.
Constraints: readable at 48x48 px, consistent padding, crisp silhouette, low saturation, no text in image.
Avoid: cyberpunk, neon, RGB, realistic 3D, copied game artwork, noisy background.
```

### Scene Banner

```text
Generate a fantasy MMORPG environment scene banner for OneShort web UI.

Style: warm cozy fantasy MMORPG utility UI, premium SaaS dashboard asset, low saturation, warm beige and muted brown palette.
Composition: calm environment, one clear off-center focal point, quiet empty space on one side for HTML text and controls.
Aspect ratio: use the product slot ratio, default 16:9 or wide banner.
Avoid: centered clutter, action chaos, cyberpunk, neon, RGB, realistic 3D, copied game artwork, text in image.
```

### Party Thumbnail Illustration

```text
Generate a fantasy MMORPG party thumbnail illustration for OneShort.

Style: warm cozy fantasy MMORPG utility UI, premium casual MMORPG feeling, polished 2D chibi fantasy style.
Composition: compact group of 3-5 characters or a recognizable party activity, readable at card thumbnail size.
Palette: warm beige, muted brown, soft olive, muted gold, low saturation.
Constraints: no UI text, no status labels, no copied game artwork.
Avoid: battle splash art, cyberpunk, neon, RGB, realistic 3D, crowded detail.
```

### Empty State Illustration

```text
Generate a small empty-state illustration for OneShort.

Subject: quiet fantasy notice board, mushroom sign, small campfire, empty guild hall, or map table.
Style: warm cozy fantasy MMORPG utility UI, simple polished 2D illustration, low saturation.
Composition: compact object or calm scene with enough surrounding whitespace for HTML title, one sentence, and one action button.
Avoid: sad dramatic character, large poster art, text in image, neon, cyberpunk, realistic 3D.
```

### Guild Emblem Or Banner

```text
Generate a OneShort guild visual asset.

Type: guild emblem or wide guild banner.
Style: warm cozy fantasy MMORPG utility UI, muted gold and brown, soft olive accents, polished 2D.
Composition: simple crest, fabric banner, guild hall cue, or gathering symbol; readable in dashboard UI.
Constraints: no text in image, no copied game insignia, no ornate launcher-style frame.
Avoid: neon, RGB, dark sci-fi, realistic 3D, excessive fantasy chrome.
```

### Boss Thumbnail

```text
Generate a OneShort boss thumbnail illustration.

Style: warm cozy fantasy MMORPG utility UI, simplified fantasy boss silhouette or themed arena cue, polished 2D, low saturation.
Composition: readable thumbnail, one dominant shape, warm atmospheric background, no UI text.
Constraints: do not copy official game art; keep the boss name as real HTML text in the UI.
Avoid: chaotic battle splash, horror realism, neon, cyberpunk, RGB, realistic 3D.
```
