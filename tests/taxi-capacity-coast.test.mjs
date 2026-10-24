import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const c=vm.createContext({window:{}});vm.runInContext(read('src/coast-road-network.js')+'\n'+read('src/taxi.js').split('// Scene adapter:')[0],c);
const m=vm.runInContext('CityTaxiModel',c),network=vm.runInContext('RoadsterCoastRoads',c),city=m.buildRoadGraph([-900,-600,-300,0,300,600,900]),coast=m.buildCoastGraph(network);
const random=(seed)=>()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
const move=(s,p,grounded=true)=>{s.pause(p);return s.advance(p,grounded);};
for (const [name, graph] of [['city', city], ['coast', coast]]) {
 test(`${name}: one occupied seat rejects every other pickup and pays only its fare before the next ride`, () => {
  const s = m.createSession(graph, random(3)); s.start(graph.nodes[0]);
  const trip = s.snapshot().waiting[0]; assert.equal(move(s, trip.pickup).type, 'picked-up');
  const ids = s.snapshot().waiting.map(t => t.id).join(',');
  assert.equal(s.snapshot().capacity, 1); assert.equal(s.snapshot().passengers.length, 1);
  for (const other of s.snapshot().waiting.filter(t => t.pickup.id !== trip.destination.id)) {
   for (let repeat = 0; repeat < 5; repeat++) assert.equal(move(s, other.pickup), null);
   const d = s.snapshot(); assert.equal(d.passenger.id, trip.id); assert.equal(d.passengers.length, 1);
   assert.equal(d.waiting.map(t => t.id).join(','), ids); assert.equal(d.score, 0); assert.equal(d.delivered, 0);
  }
  const delivered = move(s, trip.destination); assert.equal(delivered.type, 'delivered'); assert.equal(delivered.trips.length, 1);
  assert.equal(s.snapshot().passenger, null); assert.equal(s.snapshot().score, trip.fare); assert.equal(s.snapshot().delivered, 1);
  const next = s.snapshot().waiting[0]; assert.equal(move(s, next.pickup).type, 'picked-up');
  assert.equal(s.snapshot().passenger.id, next.id); assert.equal(s.snapshot().score, trip.fare);
  const loss = s.destroy(next.pickup); assert.equal(loss.trip.id, next.id); assert.equal(loss.trips.length, 1); assert.equal(loss.penalty, 2 * next.fare);
  const finalScore = Math.max(0, trip.fare - next.fare * 2); assert.equal(s.snapshot().score, finalScore);
  for (let i = 0; i < 5; i++) { assert.equal(s.destroy(next.pickup), null); assert.equal(move(s, next.destination), null); }
  assert.equal(s.snapshot().passengers.length, 0); assert.equal(s.snapshot().finished, true); assert.equal(s.snapshot().score, finalScore);
  s.reset(graph.nodes[0]); assert.equal(s.snapshot().score, 0); assert.equal(s.snapshot().finished, false); assert.equal(s.snapshot().waiting.length, 5);
  assert.equal(move(s, s.snapshot().waiting[0].pickup).type, 'picked-up'); assert.equal(s.snapshot().passengers.length, 1);
 });
 test(`${name}: a single swept update crossing several waiting stops admits just one and repeated updates cannot add a seat`, () => {
  const s = m.createSession(graph, random(3)); s.start(graph.nodes[0]); const waiting = s.snapshot().waiting;
  let fixture;
  for (const a of waiting) for (const b of waiting) {
   if (a.id === b.id) continue;
   const eligible = waiting.filter(t => m.withinArrival(a.pickup, b.pickup, t.pickup, m.PICKUP_RADIUS));
   if (eligible.length >= 2 && !m.withinArrival(b.pickup, b.pickup, eligible[0].destination)) fixture ||= { a, b, eligible };
  }
  assert.ok(fixture, 'use real generated waiting stops and a sweep crossing at least two');
  s.pause(fixture.a.pickup); const event = s.advance(fixture.b.pickup, true);
  assert.equal(event.type, 'picked-up'); assert.equal(event.trips.length, 1); assert.equal(event.trip.id, fixture.eligible[0].id);
  const ids = s.snapshot().waiting.map(t => t.id).join(',');
  for (let repeat = 0; repeat < 20; repeat++) {
   assert.equal(s.advance(fixture.b.pickup, true), null); const d = s.snapshot();
   assert.equal(d.passengers.length, 1); assert.equal(d.passenger.id, event.trip.id); assert.equal(d.waiting.map(t => t.id).join(','), ids);
   assert.equal(d.score, 0); assert.equal(d.delivered, 0);
  }
 });
 test(`${name}: delivery overlapping another waiting stop settles only the old ride, then permits pickup on the next update`, () => {
  let fixture;
  for (let seed = 1; seed <= 100 && !fixture; seed++) {
   const s = m.createSession(graph, random(seed)); s.start(graph.nodes[0]); const waiting = s.snapshot().waiting;
   for (const trip of waiting) {
    const next = waiting.find(t => t.id !== trip.id && t.pickup.id === trip.destination.id);
    if (next) { fixture = { s, trip, next }; break; }
   }
  }
  assert.ok(fixture, 'generated shared destination/pickup, no synthetic route or relaxed radius');
  const { s, trip, next } = fixture; assert.equal(move(s, trip.pickup).type, 'picked-up');
  const event = move(s, trip.destination); assert.equal(event.type, 'delivered'); assert.equal(event.trips.length, 1);
  assert.equal(s.snapshot().passengers.length, 0, 'no same-update pickup after delivery');
  assert.equal(s.snapshot().score, trip.fare); assert.equal(s.snapshot().delivered, 1);
  const pickup = s.advance(trip.destination, true); assert.equal(pickup.type, 'picked-up'); assert.equal(pickup.trip.id, next.id);
  assert.equal(s.snapshot().passengers.length, 1); assert.equal(s.snapshot().score, trip.fare);
  for (let repeat = 0; repeat < 10; repeat++) assert.equal(s.advance(trip.destination, true), null);
  assert.equal(s.snapshot().score, trip.fare); assert.equal(s.snapshot().delivered, 1);
 });
 test(`${name}: many deterministic single-seat refills keep five distinct waiting stations and never duplicate fares or IDs`, () => {
  for (let seed = 1; seed <= 12; seed++) {
   const s = m.createSession(graph, random(seed)); s.start(graph.nodes[0]); let expected = 0, deliveries = 0; const paid = new Set();
   for (let i = 0; i < 80; i++) {
    const before = s.snapshot(); const p = before.passenger ? before.passenger.destination : before.waiting[i % 5].pickup;
    const event = move(s, p); assert.ok(event);
    if (event.type === 'delivered') { assert.equal(paid.has(event.trip.id), false); paid.add(event.trip.id); expected += event.trip.fare; deliveries++; }
    const after = s.snapshot(); assert.ok(after.passengers.length <= 1); assert.equal(after.capacity, 1); assert.equal(after.waiting.length, 5);
    assert.equal(new Set(after.waiting.map(t => t.id)).size, 5); assert.equal(new Set(after.waiting.map(t => t.pickup.id)).size, 5);
    assert.ok(after.waiting.every(t => t.id !== after.passenger?.id)); assert.equal(after.score, expected); assert.equal(after.delivered, deliveries);
   }
   assert.equal(deliveries, 40);
  }
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
