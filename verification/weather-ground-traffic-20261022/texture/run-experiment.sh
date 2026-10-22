#!/usr/bin/env bash
# Explicit output directory is mandatory: raw captures/PNGs are not repository artifacts.
set -euo pipefail
HERE=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO=${1:-$(CDPATH= cd -- "$HERE/../../.." && pwd)}
REPO=$(CDPATH= cd -- "$REPO" && pwd)
OUT=${2:?Usage: run-experiment.sh REPOSITORY OUTPUT_DIRECTORY}
mkdir -p "$OUT"
OUT=$(CDPATH= cd -- "$OUT" && pwd)
python3 "$HERE/build-experiment.py" --repo "$REPO" --output "$OUT"
for CASE in 1 4 8 cap4 unsupported; do
  node "$OUT/native-paver-capture.mjs" "$REPO" "$OUT/capture-$CASE.json" "$HERE/options-$CASE.json" > "$OUT/recorder-$CASE.log"
  python3 "$REPO/verification/render-instance-20261022/egl-replay.py" replay "$OUT/capture-$CASE.json" "$OUT/paver-$CASE.png" > "$OUT/replay-$CASE.json"
done
python3 "$HERE/analyze-evidence.py" --repo "$REPO" --output "$OUT"
