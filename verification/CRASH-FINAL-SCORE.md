# Preserve crash results, reset on a new round

Base: published main cf3e7729c863e3d40e4645c0dbe83ab556d51ade. Local branch: fix/preserve-crash-final-score. This change implements the clarification that a crash must show the completed round's score, while respawn or R starts scoring from zero. It does not change traffic, vehicle geometry, distance bonuses, server protocol, accounts, credentials or stored leaderboard records.

## Lifecycle

1. destroyVehicle marks the car destroyed and invokes the existing passenger-loss settlement. A passenger on board deducts twice the fare once, with a zero floor; an empty car preserves its earned fares. The taxi model then marks the round finished, blocking all further pickups and payouts until reset.
2. RoadsterDrivingScore.freeze copies and freezes driving score, physical metres, all six distance-band accumulators, vehicles cleared and blasted-car count before blast effects run. Death frames restore this immutable result instead of zeroing it. The crash summary and HUD display the retained values; the cockpit shows the settled passenger score.
3. Ranked abort('crash') still runs immediately during destruction and queues the server end request before waiting for respawn. An incomplete crashed challenge is not submitted. Restart waits for acknowledgment of the exact prior run's end and then starts immediately, without an arbitrary 65-second delay. A previously completed immutable ranked result remains reviewable and can be explicitly submitted unchanged after a later sandbox crash/reset; accepted historical records are untouched.
4. Shared resetCar, used by R, vehicle/respawn buttons, mobile reset, map reset, ranked normalization and any automatic caller, starts a new round. It clears the driving result and accumulators, clear/blast counts, passenger total and delivered count, old passenger-loss notice, and finished flag. Passenger mode stays active in the city, with a fresh waiting pool. HUD/cockpit refresh synchronously. Nonfatal collisions leave the round intact.

Examples: with 10,000 passenger points and an onboard 2,000-point fare, the crash settles to 6,000 and keeps that result until respawn. Empty-car death keeps 10,000. Insufficient points settle to zero. A fresh round always starts at zero.

## Verification

- Full Node suite: 404 passed, 0 failed.
- Targeted lifecycle/model/mobile/ranked suite: 132 passed, 0 failed.
- Lua runtime regression suite: 24 passed.
- npm run check: syntax, inline bundle, unique DOM IDs, deterministic bundle and deployment configuration passed.
- npm run build and git diff --check: passed.
- Independent read-only review: passed, including an independent full 404-test run and final 132-test focused run.

Coverage includes both maps; impact, ground and cumulative-damage deaths; preserved scores and counters; copied/frozen arrays and stale-write restoration; repeated death/wait/late callbacks; onboard and empty-car fare settlement; zero-floor and direct model post-death payout blocking; respawn/button/R/shared reset; actual mobile reset wiring and released controls; immediate ranked end, delayed end acknowledgment and immediate restart; immutable completed-but-unsubmitted payload after death/R; and retained historical scores. Obsolete zero-on-death copy is updated in both languages.

An initial test-only mobile stub was missing handleKeydown while testing the actual keyboard route; it was corrected and the complete final suite rerun. No production failure was bypassed or suppressed.

## Limits and integration

These are production-code deterministic DOM/simulation/API tests. Real WebGL visual gameplay and a live deployed/Upstash challenge were not exercised in this cloud environment. All work is local; publication is left to the parent integration task.

No tail/body geometry files or NPC assets are changed. If another reviewed change lands first, integrate serially and regenerate index.html rather than manually resolving its generated JavaScript. Relevant source changes are config.js, driving-score.js, physics-main.js, taxi.js and ui-hud.js; there are no backend/API edits.
