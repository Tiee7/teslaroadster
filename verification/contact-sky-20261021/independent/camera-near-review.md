# Candidate near cap — independent read-only review

Reviewed current physics-main SHA-256 `ca6dd107d4d81f3b628d7752d1ed6422e4e2e0495263aa4768da58e739907302`. Native Three r128; frozen 13b9 assets (unchanged by candidate). No repo tests, check, build, deployment, or edits.

**Accept for the explicitly limited goal:** cap the old altitude-driven near plane after the actual final camera transform, without moving camera position, lookAt, zoom, FOV, core mesh geometry, index, normals, scale, loader, material, or FPV policy. The OBB support expression `dot(center-camera,forward)-projectionRadius` correctly gives the nearest OBB view depth. The 0.05 margin is conservative when that nearest depth is greater than 0.13 m. Actual rendered visualY and full YXZ attitude are supplied. Caching is inherited from the production contact bounds helper.

Independent 90-case vertex containment sweep includes zoom .55 / .75 / 1.35, five orbit angles, neutral and large pitch/yaw/roll. No canopy vertex was near-clipped in those samples. At .75 and 1.35 no tested static visible geometry vertex was clipped. Seven .55 cases have some vertices below .08; each is an ultra-close body/wing pose with vertices at or behind the camera plane. A simple neutral example: zoom .55, orbit +pi/2, rear wing minimum view depth -0.1384 m. The candidate leaves near at .08 and deliberately does not move the camera to hide this geometric framing boundary.

**Not an all-pose or all-mesh guarantee.** Canonical neutral preview OBB does not certify every dynamically animated wing state, nor can a positive near plane retain geometry already behind the camera. This boundary is consistent with the parent's stated scope; no extra zoom/asset changes are recommended as part of this patch.

**Not a diagnosis of the user's screenshot.** It fixes an independently verified pre-existing altitude/near defect; the screenshot's camera state remains unknown. Parent reports its real production camera-branch regression is being closed by actual roof-triangle clipping evidence, rather than arbitrary near<1 threshold. This review did not rerun that suite.

Detailed samples: `candidate-near-independent.json`; exact CPU audit script: `readonly-audit.cjs`.
