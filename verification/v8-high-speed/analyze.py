"""Optional CPU-WAV spectral audit; numpy is verification-only, not an app dependency."""
import json
import sys
import wave
from pathlib import Path
import numpy as np

directory = Path(sys.argv[1])
audit = json.loads((directory / 'comparison.json').read_text())
for case in audit['cases']:
    for version in ['before', 'after']:
        record = case[version]
        with wave.open(str(Path(record['outputDirectory']) / 'v8-ev-acceleration-cpu-preview.wav'), 'rb') as wav:
            rate = wav.getframerate()
            samples = np.frombuffer(wav.readframes(wav.getnframes()), dtype='<i2').astype(float) / 32768
        steady = samples[rate:int(rate * 2.9)]
        power = np.abs(np.fft.rfft(steady * np.hanning(len(steady)))) ** 2
        frequencies = np.fft.rfftfreq(len(steady), 1 / rate)
        record['spectral'] = {
            'steadyRms': float(np.sqrt(np.mean(steady * steady))),
            'centroidHz': float((power * frequencies).sum() / power.sum()),
            'powerAbove1000HzFraction': float(power[frequencies >= 1000].sum() / power.sum()),
            'powerAbove2000HzFraction': float(power[frequencies >= 2000].sum() / power.sum()),
            'dominantHz': float(frequencies[np.argmax(power)]),
        }
audit['spectralMethod'] = 'Mono PCM16 CPU reference; steady 1.0–2.9s; Hann-windowed numpy rfft power, unnormalized absolute digital gain. No native browser or subjective listening verification.'
(directory / 'comparison-spectral.json').write_text(json.dumps(audit, indent=2) + '\n')
