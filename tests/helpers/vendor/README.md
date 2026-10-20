# Test-only Three r128 math oracle

`three-r128-MathUtils.mjs` is the unmodified official `r128/src/math/MathUtils.js` downloaded from:
https://raw.githubusercontent.com/mrdoob/three.js/r128/src/math/MathUtils.js

SHA-256: `09ee4ebbae9976c1c9803eaafe5cb7553fcd58f34293fd557dc51c2ac8fe1f61`.
Its upstream MIT license is retained in `three-r128-LICENSE`.
The page loads the same Three release from `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`.

Demo, lifecycle and jet helpers use this module rather than algebraically rewritten clamp/lerp substitutes. In particular r128 lerp is `(1-t)*x+t*y`; `x+(y-x)*t` is mathematically equivalent but not bitwise equivalent. Verification native assembly receives the same imported object.

Only clamp and lerp are used in these numerical physics sections. This import does not reproduce the renderer, geometry, GPU or full browser loop. Its random helpers have the host Math closure and a shared module seed; they are not part of the per-simulation traffic RNG oracle and must not be used as if they were.
