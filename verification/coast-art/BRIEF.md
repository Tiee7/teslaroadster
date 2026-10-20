# Coastal District art development · 2026-10-20

- Authorized work window: 16:23:18–23:23:18 UTC (2026-10-21 00:23:18–07:23:18 Beijing).
- Worker began direct inspection at 16:24:41 UTC. Time is wall-clock, not a claim of seven iterations equalling seven hours.
- Independent baseline: `4e979c32e57e658ed945118efb1281a32fd9fdd1`, tree `cc386238509f71de7dc8c48b7d218f82a3c3eaa4`. Production GitHub main at assignment: `c4c4fa46df5ac275feb1958ee0387c999181723e` (connector confirmed); local origin is an older local mirror, not the GitHub remote.
- Scope: map 3 art only. Keep road/surface data, obstacle data, traffic, car physics, autopilot, jets, map 1/2 unchanged. Initially external writes were paused; after the user's18:08 repository confirmation and verified phone release, root explicitly delegated this worker the art-only PR, normal merge and production terminal monitoring at18:38. Fresh frozen-candidate full tests, independent review and exact phone/numerical preservation remain mandatory; no protection/denial bypass or history rewriting.

## Direction

A restrained, sun-faded west-coast seaside district: warm chalk plaster, faded seafoam, terracotta accents, blue-grey glazing, warm limestone pavement, dark fine-grain asphalt, timber pier. A shared 3.4m floor rhythm, recessed dark frames, pale deep window reveals, thin metal balcony rails and shaded shopfronts. Buildings vary by vertical bays, roof terraces, corner towers, continuous cornice and parapet silhouettes rather than a random asset mix. No brands, GTA assets, copied map data, paid services or unknown executables.

First quality gate is a 200–300m section of the spawn-side boulevard, including three original hero compounds with 8–12 storefront bays/parcel edges, with unchanged road clearance. Expand the same system only after exact-geometry views have been inspected.

## Initial budgets (map-owned only)

- Zero additional network asset requests. Procedural textures are generated locally only on entering map 3.
- <= 128 static mesh batches (base pass upper bound, not measured draw calls), <= 220,000 instanced triangles; target < 100k where feasible.
- <= 4 MiB mipmapped procedural texture GPU estimate; no texture larger than 512×512.
- No per-building lights, no alpha-blended window panes, no heavy imported GLB. Reuse instance batches and materials. Dynamic work remains the existing wheel; later map-local water motion must be bounded and optional.
- Network/loading ceiling: zero additional art requests and at most32KiB gzip for the whole coast module. Record cold/warm Node entry cost on the same environment separately; it is not a mobile-loading or GPU timing claim. Original app payload and future shadow allocations must not be hidden inside the small procedural-asset count.
- Map entry/exit must release all owned geometry, material, textures and instance buffers exactly once, and leave shared objects untouched.
- Shadows must be assessed against existing shared light frustum before enabling indiscriminately. No claim of measured performance without real renderer evidence.

## Evidence limits

Existing cloud browser cannot create a Three WebGL context. Earlier Chromium socket/file restrictions are not bypassed. Preinstalled Blender Cycles CPU can render **the exact exported production Three geometry** with an explicitly disclosed independent lighting/material approximation; those are offline art inspection renders, not gameplay screenshots and not proof of WebGL shading/FPS. Browser/WebGL acceptance stays open until a legitimate working renderer is available.

## Budget transition after the sample gate

The sample stayed below the original50k/60-batch gate through Round03 (including fourth-row windows, actual doors, geometric signs and courtyard continuity). The whole-district sculpted foliage/facade phase now has an explicit **180,000 triangle /96 base-mesh-batch** ceiling and4MiB texture ceiling, tighter than the initial global220k/128 plan. This is not a disguised performance pass: original50k structural assertions are deliberately updated to the public map-local art budget, while all motion, collision, graph and ownership gates stay intact. Every phase records its actual count. Real GPU/FPS acceptance is still unavailable.

## Local-only lighting bridge approval

Root approved a minimal explicit `world.js` visual bridge after the mobile worker confirmed that file unchanged. No numeric-epoch source is modified. Only active coast temporarily hides the three bridge-listed shared lights; original visibility and scene references restore on exit, while shared weather parameters keep the last selected preset. The map-owned1024² shadow render target and renderer/driver allocations are **not** included in the4MiB procedural source-texture mip-level estimate. Actual renderer memory/FPS remain unmeasured.
