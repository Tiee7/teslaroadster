// Explicit authorized successor. Historical semantic proofs read exact f2
// fixtures only for the changed presentation files. Live hash/negative guards
// still read every actual current file, including the new replay modules.
import { readFileSync } from 'node:fs';
export const readLiveSource = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
export const replayEpoch = JSON.parse(readLiveSource('verification/replay-camera-lighting-20261024/source-epoch.json'));
export const replayPins = replayEpoch.authorizedSourceSha256;
export const replayHistoricalPath = path => replayEpoch.baselineSourceFixtures[path]?.path || path;
