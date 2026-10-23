// Expected RED: the exact6bf9 fixture incorrectly kills a reset player beneath
// a flying NPC. Keep this file/log; it is not part of the passing final suite.
import test from'node:test';import assert from'node:assert/strict';
import{highwayRun}from'../../tests/helpers/highway-blast-harness.mjs';
for(const fps of[30,60,144])for(const delay of[0,.2])test(`6bf9 reset player must survive the vertically separated blasted NPC (${fps}Hz,delay${delay})`,()=>{const r=highwayRun({old:true,fps,delay});assert.equal(r.h.state.isDestroyed,false);});
