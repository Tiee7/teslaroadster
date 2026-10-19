# Highway demo driving

The native **Demo drive / 演示模式** switch is available only on Map 01, the six-lane elevated highway. It stays reachable in all three HUD modes. It has no keyboard shortcut, starts off, and is not persisted across reloads. Land before enabling it. Switch off to regain manual control.

## Behavior

The driver supplies ordinary analog inputs through the same production input reader as keyboard and mobile controls. It never writes the vehicle's speed, horizontal position, tank, score, collision result, or NPC behavior. In normal Realistic driving it aims for 220+ km/h, with a 250 km/h cruise target in traffic. Empty-road, Plaid and Fantasy propulsion retain their existing limits. Acceleration from rest and after congestion is physical; the speedometer is unchanged.

Following the user's explicit congestion choice, an unsafe or unavailable passing gap permits temporary slowing. The driver releases throttle/rear boost before using the existing H mechanical brake and paid high-speed reverse jets. It follows actual traffic until a safe useful route opens, then releases braking and resumes acceleration/boost. Fuel is consumed and recharged only by the existing physics rules. A real tank reserve is retained for emergencies.

The planner considers actual NPC x/z, speed, observed acceleration, active lane-change motion, rear approaches, hidden/waiting spawns and low wreck motion. First-gap validation, route ranking and the emergency test use one numerical steering/yaw/velocity trajectory. Selected adjacent-center routes are retained and rechecked as each stage completes. Normal targets are complete lane centers, never the stripes. Prediction is bounded and cannot guarantee collision-free driving against every initial or sudden configuration.

A short hop is a last resort when the predicted physical collision cannot be avoided by the selected route and real braking. The shared O-jump action supplies a lower obstacle-clearance target, with real lift consumption. Only this demo hop may retain its existing launch vector for a bounded 0.95-second grace; the ordinary manual O grace remains 0.25 seconds. Ground contact clears the demo grace immediately. There is no airborne throttle, rear boost, altitude hold or sustained lift request after launch. Brief paid lateral correction can finish the committed center or escape a low-speed roof rebound. Normal gravity and landing assistance remain active.

## Input and lifecycle

The switch owns driving inputs while active or preparing; held keyboard, legacy hold buttons and mobile sticks cannot inject a competing drive command. Stopping clears both virtual and manual held inputs. Camera, HUD, language and ordinary browser shortcuts remain usable. Reset, destruction, map/mode/traffic changes, opening map/help/leaderboard/audio/paint menus, blur, hidden and page exit stop the demo, without automatically restarting it on return.

## Ranked isolation

Enabling first invalidates any starting/running 60-second challenge and awaits its exact server cancellation, including an issuance that arrives late. An unconfirmed end fails closed and retains that run ID for retry. The demo cannot start a ranked run, including a programmatic disabled-button dispatch. It never creates or submits an automatic result. A previously completed immutable manual result remains its original manual snapshot and keeps the ordinary Submit/Discard flow before another challenge. Switching off allows a fresh manual challenge after pending ends are confirmed; there is no intentional 65-second local lock.

## Verification and limits

Focused tests run the production controls, tank, horizontal/vertical motion, NPC driver update and collision code. They cover from-rest acceleration, lane centering and completion, a fast rear approach, an unavoidable close wall, safe H-following, clearing congestion and recovering 220+, empty/freefall/last-drop braking, manual control preservation, input ownership, menus, reset/crash and asynchronous ranked lifecycle races.

`scripts/verify-demo.mjs` runs seeded production traffic at 20/36/52 cars and 30/60/144/irregular frame intervals, with 90-second observation windows. The report records real collisions, speed percentiles, time above 220, center occupancy, maximum stripe interval, completed changes, actual overtaking encounters, hop counts/chains, air fraction, tank minimum and airborne jet time. See the [measured report and adverse boundaries](../verification/highway-demo/README.md). Lower speeds reflect both traffic and the bounded conservative planner; this is not a proof that every low-speed interval is physically unavoidable, or that the fastest safe route was found.

The deterministic DOM tests cover mobile controls and menu interruption. CPU simulation is not a real-device interaction or WebGL visual/FPS test; those limitations are retained rather than presented as browser validation.
