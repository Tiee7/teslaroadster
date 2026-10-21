// Bounded, local-only incident recorder. Nothing is uploaded or persisted.
// Console: JSON.stringify(RoadsterCityDiagnostics.snapshot(), null, 2)
(() => {
  const fields=['x','y','z','vx','vy','vz','yaw','pitch','roll','airRemaining','hullIntegrity','wasAirborne','throttle','brake','reverse','boost','lift','descend'];
  const capacity=96,rows=Array.from({length:capacity},()=>new Float64Array(fields.length));
  let head=0,count=0,tick=0,seconds=0,contact=null,last=null;
  const clone=value=>JSON.parse(JSON.stringify(value));
  function begin(state,dt,input){
    tick++;seconds+=Math.max(0,Number.isFinite(dt)?dt:0);contact=null;const row=rows[head];
    for(let i=0;i<fields.length;i++){const key=fields[i],value=i<12?state[key]:input?.[key];row[i]=Number.isFinite(Number(value))?Number(value):0;}
    head=(head+1)%capacity;count=Math.min(capacity,count+1);
  }
  function impact(state,deltaV,reason){
    const trace=[];for(let i=0;i<count;i++)trace.push(Array.from(rows[(head-count+i+capacity)%capacity]));
    last={schema:'roadster-city-incident-v2',revision:'city-cyber-v2-20261021',map:'city',tick,seconds,
      contact:clone(contact||{kind:'unclassified'}),deltaV,deltaVKmh:deltaV*3.6,reason,
      pose:{x:state.x,y:state.y,z:state.z,vx:state.vx,vy:state.vy,vz:state.vz,yaw:state.yaw,pitch:state.pitch,roll:state.roll},
      fields:fields.slice(),trace,destroyed:false};
  }
  function destroy(state,reason){if(!last||last.tick!==tick)impact(state,0,reason);last.destroyed=true;last.reason=reason;last.hullIntegrity=state.hullIntegrity;}
  window.RoadsterCityDiagnostics=Object.freeze({begin,contact(value){contact=value;},impact,destroy,
    snapshot:()=>last?clone(last):null,reset(){head=count=0;contact=null;},
    stats:()=>({capacity,storedFrames:count,bytes:rows.reduce((n,r)=>n+r.byteLength,0),hasIncident:Boolean(last)})});
})();
