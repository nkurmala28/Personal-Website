import {test} from 'node:test';
import assert from 'node:assert/strict';
import {containBall,advanceLaneBall,ballSubsteps,laneAngle,keeperDifficulty,predictGoalOffset,reboundGoal} from '../src/penalty-physics.mjs';
const lane={ri:3.36,ro:4.74,rb:.17,a0:104*Math.PI/180,a1:256*Math.PI/180};
function inside(p){const r=Math.hypot(p.x,p.y),a=laneAngle(p,lane),m=Math.asin(lane.rb/r);assert.ok(r>=lane.ri+lane.rb-1e-9&&r<=lane.ro-lane.rb+1e-9);assert.ok(a>=lane.a0+m-1e-9&&a<=lane.a1-m+1e-9);}
test('hard shots in every direction stay in the curved course, including slow frames',()=>{
 for(const dt of [1/120,1/60,.05])for(let angle=0;angle<Math.PI*2;angle+=Math.PI/24){
 const a=lane.a1-.3,r=(lane.ri+lane.ro)/2,p={x:r*Math.cos(a),y:r*Math.sin(a)},v={x:21*Math.cos(angle),y:21*Math.sin(angle)};
 for(let frame=0;frame<180;frame++){const n=ballSubsteps(Math.hypot(v.x,v.y),dt,lane.rb);for(let j=0;j<n;j++){const speed=Math.hypot(v.x,v.y);advanceLaneBall(p,v,dt/n,lane);inside(p);assert.ok(Math.hypot(v.x,v.y)<=speed+1e-9);}}
 }
});
test('wall correction also recovers a ball already moving back into the lane',()=>{
 const p={x:lane.ro+1,y:0},v={x:-1,y:2};containBall(p,v,lane);inside(p);
 const q={x:-lane.ro,y:0},w={x:-12,y:0};containBall(q,w,lane);assert.ok(w.x>0);inside(q);
});
test('bank shots can reach either goal direction without escaping',()=>{
 for(const s of [1,-1]){let reaching=0;const ag=s===1?lane.a0+.2:lane.a1-.2,a=s===1?lane.a1-.3:lane.a0+.3,r=(lane.ri+lane.ro)/2;
 for(let angle=0;angle<Math.PI*2;angle+=Math.PI/36){const p={x:r*Math.cos(a),y:r*Math.sin(a)},v={x:21*Math.cos(angle),y:21*Math.sin(angle)};if(predictGoalOffset(p,v,{...lane,ag,s},1.8)!==null)reaching++;}
 assert.ok(reaching>8,`reachable bank-shot angles: ${reaching}`);}
});
test('keeper improves with goals already scored, especially fourth and fifth attempts',()=>{
 let prev=keeperDifficulty(0);for(let goals=1;goals<=4;goals++){const d=keeperDifficulty(goals);assert.ok(d.speed>prev.speed&&d.reach>prev.reach&&d.reaction<prev.reaction&&d.horizon>prev.horizon);prev=d;}
});
test('goal-line deflections stay inside and preserve inward radial travel',()=>{
 const ag=lane.a0+.2,s=1,r=4.05,p={x:r*Math.cos(ag),y:r*Math.sin(ag)},v={x:10*Math.sin(ag),y:-10*Math.cos(ag)};
 reboundGoal(p,v,{...lane,ag,s});inside(p);assert.ok(v.x*Math.sin(ag)-v.y*Math.cos(ag)<0);
});
