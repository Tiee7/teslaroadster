# Static projection identity-only tests

All 29 tests passed.

- positive-identity: 3
- first-bind-rejection: 9
- cached-reference-or-value-rejection: 5
- positive-build: 1
- build-source-rejection: 8
- build-generator-rejection: 1
- build-profile-rejection: 1
- build-artifact-rejection: 1

No physics, jump entry, driver, browser, full update or math-function body was executed. Positive source functions were declarations for identity only; the actual vendor bundle was not loaded again. Build mutations were confined to a temporary mirror, and every recorded live source/generated artifact hash remained unchanged. This tests identity/build guards, not numerical equivalence, gameplay, scheduler timing or page provenance.

1. PASS: CPU exact recorded math pair binds
2. PASS: minified exact recorded math pair binds
3. PASS: missing function rejected
4. PASS: nonfunction rejected
5. PASS: different helper source rejected
6. PASS: different full update source rejected
7. PASS: unknown math pair rejected
8. PASS: mixed recorded math pair rejected
9. PASS: wrong gravity constant rejected
10. PASS: wrong handling value rejected
11. PASS: missing handling key rejected
12. PASS: same-source new helper reference rejected
13. PASS: same-source new math reference rejected
14. PASS: equal-value new handling reference rejected
15. PASS: cached gravity mutation rejected
16. PASS: cached lane value mutation rejected
17. PASS: restoring original reference restores valid identity
18. PASS: unchanged source mirror generates exact artifact
19. PASS: changed complete source rejects: src/config.js
20. PASS: changed complete source rejects: src/physics-main.js
21. PASS: changed complete source rejects: src/highway-demo.js
22. PASS: changed complete source rejects: src/highway-traffic.js
23. PASS: changed complete source rejects: src/ui-hud.js
24. PASS: changed complete source rejects: src/audio.js
25. PASS: changed complete source rejects: tests/helpers/demo-harness.mjs
26. PASS: changed complete source rejects: tests/helpers/vendor/three-r128-MathUtils.mjs
27. PASS: changed frozen generator rejects
28. PASS: changed math profile artifact rejects
29. PASS: changed emitted bytes reject
