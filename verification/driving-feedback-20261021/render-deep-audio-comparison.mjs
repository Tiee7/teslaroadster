// Local reference DSP only; no native audio/browser/listening acceptance.
import{readFileSync,writeFileSync}from'node:fs';import{renderEngineSoundPreview}from'../../scripts/render-engine-sound-preview.mjs';
const root='verification/driving-feedback-20261021',options={duration:7,controls:t=>({speed:Math.min(2,t/3),load:.9}),segments:[['low',.5,1.5],['high',5.5,6.5]]};
const before=await renderEngineSoundPreview('/workspace/shared/driving-feedback-audio-before-20261021',{...options,source:readFileSync('tests/fixtures/v8-before-deep-20261021.js','utf8')});
const after=await renderEngineSoundPreview('/workspace/shared/driving-feedback-audio-deep-20261021',options);
writeFileSync(root+'/deep-audio-cpu-comparison.json',JSON.stringify({qualification:after.verification,limits:after.limits,before,after},null,2)+'\n');
