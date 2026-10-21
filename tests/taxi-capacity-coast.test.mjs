import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const c=vm.createContext({window:{}});vm.runInContext(read('src/coast-road-network.js')+'\n'+read('src/taxi.js').split('// Scene adapter:')[0],c);
const m=vm.runInContext('CityTaxiModel',c),network=vm.runInContext('RoadsterCoastRoads',c),city=m.buildRoadGraph([-900,-600,-300,0,300,600,900]),coast=m.buildCoastGraph(network);
const random=(seed)=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const move=(s,p,grounded=true)=>{s.pause(p);return s.advance(p,grounded);};
for(const [name,graph]of[['city',city],['coast',coast]]){
 test(`${name}: ten real occupied seats, five replenished pickups, full rejection and stable FIFO target`,()=>{
  const s=m.createSession(graph,random(3));s.start(graph.nodes[0]);const boarded=[];
  for(let i=0;i<10;i++){
   const trip=s.snapshot().waiting.find(t=>!s.snapshot().passengers.some(p=>p.destination.id===t.pickup.id));assert.ok(trip);
   const event=move(s,trip.pickup);assert.equal(event.type,'picked-up');boarded.push(trip);
   const d=s.snapshot();assert.equal(d.passengers.length,i+1);assert.equal(d.waiting.length,5);assert.equal(d.capacity,10);assert.equal(d.passenger.id,boarded[0].id);assert.equal(d.score,0);
  }
  const eleventh=s.snapshot().waiting.find(t=>!boarded.some(p=>p.destination.id===t.pickup.id));assert.ok(eleventh);assert.equal(move(s,eleventh.pickup),null);assert.equal(s.snapshot().passengers.length,10);
  const target=boarded.at(-1),same=boarded.filter(t=>t.destination.id===target.destination.id),event=move(s,target.destination);
  assert.equal(event.type,'delivered');assert.equal(event.trips.length,same.length);assert.equal(s.snapshot().score,same.reduce((sum,t)=>sum+t.fare,0));assert.equal(s.snapshot().passengers.length,10-same.length);
  assert.equal(move(s,target.destination),null,'no duplicate destination payout');
  const expectedPenalty=2*s.snapshot().passengers.reduce((sum,t)=>sum+t.fare,0),loss=s.destroy(target.destination);assert.equal(loss.penalty,expectedPenalty);
  assert.equal(s.snapshot().passengers.length,0);assert.equal(s.snapshot().finished,true);assert.equal(s.destroy(target.destination),null);assert.equal(move(s,eleventh.pickup),null);
  s.reset(graph.nodes[0]);assert.equal(s.snapshot().score,0);assert.equal(s.snapshot().finished,false);assert.equal(s.snapshot().waiting.length,5);
 });
 test(`${name}: many deterministic crowded refills never exhaust waiting stations or duplicate occupied IDs`,()=>{
  for(let seed=1;seed<=12;seed++){const s=m.createSession(graph,random(seed));s.start(graph.nodes[0]);for(let i=0;i<80;i++){
   const d=s.snapshot();const p=d.passengers.length===10?d.passengers[i%10].destination:d.waiting[i%5].pickup;move(s,p);
   const after=s.snapshot();assert.ok(after.passengers.length<=10);assert.equal(after.waiting.length,5);assert.equal(new Set(after.passengers.map(t=>t.id)).size,after.passengers.length);
  }}
 });
}
test('coast graph uses only the real closed elevated road with bounded arc-cost routing and full marker clearance',()=>{
 assert.equal(coast.nodes.length,32);let elevated=0;
 for(const p of coast.nodes){assert.equal(p.supportId,'road-0');if(p.y>6)elevated++;for(const edge of coast.edges[p.id]){assert.ok([1,31].includes((edge.id-p.id+32)%32));assert.equal(edge.meters,network.routes[0].length/32);}for(let i=0;i<96;i++){const a=i*Math.PI/48;assert.ok(network.candidates(p.x+4*Math.cos(a),p.z+4*Math.sin(a)).some(q=>q.id==='road-0'));}}
 assert.ok(elevated>8);assert.equal(coast.edges.flat().length,64);
});
test('elevated coast arrivals reject the ground beneath, airborne points and landing sweep, then accept the real road',()=>{
 const s=m.createSession(coast,random(9));s.start(coast.nodes[0]);const trip=s.snapshot().waiting.find(t=>t.pickup.y>6);assert.ok(trip);
 assert.equal(move(s,{...trip.pickup,y:trip.pickup.y-6}),null);assert.equal(move(s,trip.pickup,false),null);assert.equal(s.snapshot().passengers.length,0);
 s.advance({...trip.pickup,x:trip.pickup.x+10},true);assert.equal(s.snapshot().passengers.length,0,'landing cannot sweep from the previous airborne point');
 assert.equal(move(s,trip.pickup).type,'picked-up');assert.equal(s.snapshot().passenger.id,trip.id);
});
