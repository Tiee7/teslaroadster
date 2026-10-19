# Historical NPC provenance

`catalog-v3.json` preserves the exact identity, lineage, source hashes and preview
hashes of 20 historical entries / 12 different geometric versions.

Immutable originals, old tooling and quarantined experiments are retained
separately in `Tiee7/teslaroadster`, branch
`archive/vehicle-originals-v3-20261019`, file
`archives/roadster-vehicle-originals-v3-20261019.zip`.

The adjacent SHA-256 manifest lists every recoverable archive file and pins the
ZIP's complete byte hash. Extract the ZIP into a separate directory, then use its
`verification/vehicle-variants/restore-original.mjs` to recover exact source and
preview bytes. The game neither fetches nor extracts the archive.

Known failed clustering experiments remain quarantined. Live traffic uses the
separate clean `parameter-grid-boundary-v1` profiles in `src/npc-traffic-assets.js`.
