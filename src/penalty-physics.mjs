const TAU = Math.PI * 2;
export function laneAngle(p, lane) {
  const mid = (lane.a0 + lane.a1) / 2, a = Math.atan2(p.y,p.x);
  return mid + Math.atan2(Math.sin(a-mid),Math.cos(a-mid));
}
// Position correction is unconditional; reflection happens only into a wall.
// This prevents a separating ball from remaining embedded after a slow frame.
export function containBall(p,v,lane,restitution=.9) {
  const {ri,ro,rb,a0,a1}=lane;
  let r=Math.hypot(p.x,p.y), hits=0;
  if (r < 1e-9) { const a=(a0+a1)/2; r=(ri+ro)/2; p.x=Math.cos(a)*r;p.y=Math.sin(a)*r; }
  const ux=p.x/r,uy=p.y/r,lo=ri+rb,hi=ro-rb;
  if(r<lo || r>hi) {
    const normal=r<lo?-1:1, outward=(v.x*ux+v.y*uy)*normal;
    if(outward>0){v.x-=(1+restitution)*outward*ux*normal;v.y-=(1+restitution)*outward*uy*normal;}
    r=Math.max(lo,Math.min(hi,r));p.x=ux*r;p.y=uy*r;hits++;
  }
  const margin=Math.asin(Math.min(1,rb/r)),low=a0+margin,high=a1-margin,a=laneAngle(p,lane);
  if(a<low || a>high) {
    const bound=a<low?low:high,sign=a<low?-1:1,nx=-Math.sin(bound)*sign,ny=Math.cos(bound)*sign, outward=v.x*nx+v.y*ny;
    if(outward>0){v.x-=(1+restitution)*outward*nx;v.y-=(1+restitution)*outward*ny;}
    p.x=r*Math.cos(bound);p.y=r*Math.sin(bound);hits++;
  }
  return hits;
}
export function ballSubsteps(speed,dt,rb) {return Math.max(5,Math.ceil(speed*dt/(rb*.3)));}
export function advanceLaneBall(p,v,h,lane) {
  p.x+=v.x*h;p.y+=v.y*h; const drag=Math.exp(-.6*h);v.x*=drag;v.y*=drag;
  return containBall(p,v,lane);
}
export function keeperDifficulty(goals) {
 const g=Math.max(0,Math.min(4,goals));
 return {speed:.7+g*.24,reach:.20+g*.02,reaction:.30-g*.045,horizon:.35+g*.15};
}
export function predictGoalOffset(position,velocity,lane,horizon) {
 const p={x:position.x,y:position.y},v={x:velocity.x,y:velocity.y},rm=(lane.ri+lane.ro)/2;
 for(let t=0;t<horizon;t+=1/180) {
  advanceLaneBall(p,v,1/180,lane);
  if(lane.s*(laneAngle(p,lane)-lane.ag)<=0) return p.x*Math.cos(lane.ag)+p.y*Math.sin(lane.ag)-rm;
 }
 return null;
}
export function reboundGoal(p,v,lane,restitution=.85) {
 const nx=Math.sin(lane.ag)*lane.s,ny=-Math.cos(lane.ag)*lane.s,dot=v.x*nx+v.y*ny;
 if(dot>0){v.x-=(1+restitution)*dot*nx;v.y-=(1+restitution)*dot*ny;}
 const r=Math.hypot(p.x,p.y),a=lane.ag+lane.s*.055;p.x=r*Math.cos(a);p.y=r*Math.sin(a);
 containBall(p,v,lane,restitution);
}
