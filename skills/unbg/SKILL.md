---
name: unbg
description: Remove solid backgrounds, create transparent PNGs, recover alpha channels, and preserve soft edges, anti-aliasing, glow, or partial transparency from a matched image pair. Requires two pixel-aligned images of the same subject on different solid background colors; not for single-image background removal. Covers CLI and Node.js API workflows, cropping, and artifact cleanup.
---

# unbg

Extract a transparent foreground from two aligned images with different solid backgrounds. For the math and rationale, see the project README.

## Workflow

1. Confirm both inputs show the same subject at identical dimensions and pixel positions. Their backgrounds must be uniform solid colors and as distinct as possible. Black and white are ideal.
2. Run the baseline extraction before tuning:

   ```sh
   unbg bg-white.png bg-black.png -o logo.png
   ```

3. Inspect the output and the CLI measurements. Change only the option that matches the visible artifact.

## Artifact Guide

| Symptom | Action |
| --- | --- |
| Empty or sparse transparent canvas around the subject | Add `--crop`. It trims fully transparent edges and sparse edge rows or columns without changing retained pixels. |
| Automatic crop removes an intended isolated detail | Use a numeric crop threshold below the detail's alpha, such as `--crop 0.02`. Numeric cropping preserves every pixel above that threshold. |
| Faint haze remains inside the retained image | Cautiously increase `--floor`, for example `--floor 0.02`. This removes real pixels with alpha at or below the threshold. |
| Hair, glow, or other soft detail disappears | Lower or remove `--floor`. Do not use `--floor` just to reduce canvas size. |
| Pixels that should be opaque remain translucent | Cautiously lower `--ceiling`, for example `--ceiling 0.98`. It snaps alpha at or above the threshold to opaque. |
| Subject reaches a corner or background detection is wrong | Specify `--background1` and `--background2`, for example `--background1 '#fff' --background2 '#000'`. |
| `Background distance` is below `50` | Use or create more distinct source backgrounds. Thresholds cannot repair insufficient background separation. |

PNG, JPEG, and static WebP inputs are supported. Output is always PNG. PNG inputs are safest because JPEG and lossy WebP artifacts can desynchronize the pair.

## CLI

```sh
unbg <image1> <image2> [flags]
```

| Flag | Default | Purpose |
| --- | --- | --- |
| `-o, --output <path>` | derived | Output PNG path. Defaults to the inputs' shared-prefix name beside image1 and adds `-N` on collision. |
| `--background1 <color>` | auto | Background of image1 as `#rrggbb` or `r,g,b`. |
| `--background2 <color>` | auto | Background of image2. |
| `--threshold <0-255>` | `10` | Minimum per-channel background difference that informs alpha. |
| `--floor <0-1>` | `0` | Remove alpha at or below this threshold. |
| `--ceiling <0-1>` | `1` | Snap alpha at or above this threshold to opaque. |
| `--crop [0-1]` | off | Trim transparent edges automatically. A numeric threshold uses exact alpha-based bounds only. |

Backgrounds auto-detect from four corner pixels. Override them when a subject reaches a corner.

## Node API

```ts
import { readFile, writeFile } from 'node:fs/promises'
import { unbg } from 'unbg'

const [onWhite, onBlack] = await Promise.all([
    readFile('bg-white.png'),
    readFile('bg-black.png')
])
const { image } = await unbg(onWhite, onBlack, { crop: true })
await writeFile('logo.png', image)
```

`unbg` exports only `unbg(image1, image2, options?)`. It accepts opaque `Buffer` or `Uint8Array` image bytes, decodes PNG, JPEG, or static WebP, and returns `Uint8Array` PNG bytes. The caller reads input files. Set `crop` to `true` for automatic edge-density trimming or to a number for exact alpha-based bounds. The result also includes `cropClippingThreshold`, or `null` when the matte has no non-transparent pixels.

## Core API

Import raw-pixel operations from `unbg/core` when the host already decodes and encodes images:

| Export | Use it for |
| --- | --- |
| `differenceMatting(image1, image2, options?)` | Extract a raw RGBA foreground. |
| `cropContent(image)` | Trim edge rows and columns with fewer than 1% visible pixels from a raw RGBA matte. |
| `cropTransparent(image, threshold?)` | Crop a raw RGBA matte. A threshold affects only the crop bounds. |
| `detectBackground(image)` | Inspect the automatic corner-based background color. |

`unbg/core` is isomorphic and operates on opaque `{ data: Uint8Array, width, height }` inputs. `cropTransparent()` accepts transparent input. `unbg()` and the CLI are Node-only because `unbg()` loads image codecs and the CLI handles file I/O.

`unbg()` and `differenceMatting()` accept `background1`, `background2`, `channelThreshold`, `floor`, and `ceiling`. They reject invalid RGBA buffers and mismatched dimensions.
