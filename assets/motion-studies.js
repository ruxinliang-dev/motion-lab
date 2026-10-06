window.MotionStudies = { create: function(c, miniature) {
 'use strict';

 const W=1440,H=810,TAU=Math.PI*2,BLUE='#0aa9ec',INK='#1e1b19',PAPER='#fefdf9',PALE='#a6dcf5',ORANGE='#fe7236';   /* the site's own palette: --accent, --ink, --bg, --c3 */
 const SITE=['#fe7236','#01b6ff','#cc9fd2','#24cc71','#fafd5d','#94b8ac','#01b6ff','#cc9fd2'];   /* --c3 --c1 --c2 --c4 --c5 --c6 */
 const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)),mixHex=(a,b,t)=>{const A=hx(a),B=hx(b);return '#'+A.map((v,i)=>Math.round(mix(v,B[i],t)).toString(16).padStart(2,'0')).join('');};
 const clamp=x=>Math.max(0,Math.min(1,x)),mix=(a,b,t)=>a+(b-a)*t;
 function bezier(x1,y1,x2,y2){return x=>{x=clamp(x);if(x===0||x===1)return x;let lo=0,hi=1,t=x;for(let i=0;i<18;i++){t=(lo+hi)/2;const q=3*(1-t)*(1-t)*t*x1+3*(1-t)*t*t*x2+t*t*t;if(q<x)lo=t;else hi=t;}return 3*(1-t)*(1-t)*t*y1+3*(1-t)*t*t*y2+t*t*t;};}
 const standard=bezier(.2,0,0,1),out=bezier(.22,1,.36,1),inout=bezier(.65,0,.35,1);
 const seg=(t,a,b,e=standard)=>e(clamp((t-a)/(b-a)));
 const bell=(t,a,b,d,e=out)=>seg(t,a,b,e)*(1-seg(t,b,d,e));
 function spring(x){x=clamp(x);if(x===0||x===1)return x;return 1-Math.exp(-7*x)*Math.cos(12*x);}
 function rr(x,y,w,h,r,col){c.fillStyle=col;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();}
 function dot(x,y,r,col){c.fillStyle=col;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
 function line(x1,y1,x2,y2,col,w=1){c.strokeStyle=col;c.lineWidth=w;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();}
 function text(s,x,y,size,col=INK,weight=700){c.fillStyle=col;c.font=`${weight} ${size}px Arial, Helvetica, sans-serif`;c.fillText(s,x,y);}
 function stamp(n,title,sub,t){if(miniature)return;text(`0${n} / ${title}`,58,60,16,INK,500);text(sub,58,H-52,15,'#72766f',400);text('RUXIN / MOTION LAB',W-245,H-52,12,'#72766f',400);c.fillStyle='#d5d7cf';c.fillRect(58,H-31,W-116,2);}
 function guides(){c.strokeStyle='#dedfd8';c.lineWidth=1;for(const [x,y] of [[W/2,H/2],[W/2-280,H/2],[W/2+280,H/2]]){line(x-6,y,x+6,y,'#dedfd8');line(x,y-6,x,y+6,'#dedfd8');}}
 // Exaggerated curves: overshoot for pop, anticipation for the exits, and a smear that stretches pieces along their travel.
 const over=bezier(.3,1.9,.45,1),strong=bezier(.25,2.5,.4,1),inback=bezier(.6,-.5,.8,.2);
 const tri=x=>Math.asin(Math.sin(x))*2/Math.PI;
 function pill(w,h,r,col){w=Math.max(1,w);h=Math.max(1,h);rr(-w/2,-h/2,w,h,Math.min(r,w/2,h/2),col);}
 // Entry shapes, one per piece: circle, cloud, soft square, four-point star, clover, heart, flower, drop, pill, soft triangle.
 // Every shape is stored as a radius for each of 72 directions round the centre, so two shapes blend by radius alone: the outline can never cross itself or twist, however far the blend goes.
 const NP=72,TH=k=>-Math.PI/2+k*TAU/NP;
 const supR=(th,a,b,n)=>Math.pow(Math.pow(Math.abs(Math.cos(th))/a,n)+Math.pow(Math.abs(Math.sin(th))/b,n),-1/n);
 const fromCurve=f=>{const pts=[];for(let q=0;q<720;q++){const p=f(q*TAU/720);pts.push([Math.atan2(p[1],p[0]),Math.hypot(p[0],p[1])]);}return th=>{let best=1e9,r=0;for(const [an,rr] of pts){let d=Math.abs(an-th);d=Math.min(d,TAU-d);if(d<best){best=d;r=rr;}}return r;};};
 const heartR=fromCurve(t=>[2.9*16*Math.pow(Math.sin(t),3),-2.9*(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))+4]);
 const dropR=fromCurve(t=>[46*1.3*Math.sin(t)*Math.sin(t/2),-46*Math.cos(t)+4]);
 /* Six shapes, each one unmistakable: circle, flower, heart, clover, pill, fan. They used to be soft bumps that all read as a blob; now every
    one has a clear silhouette (five round petals, two lobes and a point, four leaves with a notch between them, a flat-sided capsule, five
    swept blades). Eight pieces use them in this order, and a piece blooms into the one four places on. */
 const up=th=>th+Math.PI/2;                       /* 0 is straight up */
 const stadium=(th,a,b)=>{const x=Math.cos(th),y=Math.sin(th),fl=a-b;if(Math.abs(y)<1e-6)return a;const tf=b/Math.abs(y);if(Math.abs(x)*tf<=fl)return tf;return Math.sign(x)*fl*x+Math.sqrt(Math.max(0,b*b-fl*fl*y*y));};
 /* union of circles: the farthest point where a ray from the centre leaves any of them, so petals and leaves are true round lobes */
 const circlesR=list=>th=>{const dx=Math.cos(th),dy=Math.sin(th);let r=0;for(const [cx,cy,rad] of list){const b=dx*cx+dy*cy,disc=b*b-(cx*cx+cy*cy)+rad*rad;if(disc>=0)r=Math.max(r,b+Math.sqrt(disc));}return r;};
 const petals=(n,dist,rad,start=-Math.PI/2)=>Array.from({length:n},(_,k)=>[Math.cos(start+k*TAU/n)*dist,Math.sin(start+k*TAU/n)*dist,rad]);
 const flowerR=circlesR([...petals(5,29,17),[0,0,22]]);                 /* five round petals round a centre */
 const cloverR=circlesR([...petals(4,27,21,-Math.PI/4),[0,0,10]]);     /* four leaves, a notch between each pair */
 /* the heart is a real outline (two lobes and a point), scaled to the same size as the rest and cast as a radius from its middle */
 const polyR=pts=>th=>{const dx=Math.cos(th),dy=Math.sin(th);let r=0;for(let i=0;i<pts.length;i++){const [x1,y1]=pts[i],[x2,y2]=pts[(i+1)%pts.length],ex=x2-x1,ey=y2-y1,den=dx*ey-dy*ex;if(Math.abs(den)<1e-9)continue;const t=(x1*ey-y1*ex)/den,u=(x1*dy-y1*dx)/den;if(t>0&&u>=0&&u<=1)r=Math.max(r,t);}return r;};
 const heartPts=(()=>{const raw=[];for(let q=0;q<180;q++){const t=q*TAU/180;raw.push([16*Math.pow(Math.sin(t),3),-(13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t))]);}
  const ys=raw.map(p=>p[1]),cy=(Math.min(...ys)+Math.max(...ys))/2,k=3.05;return raw.map(p=>[p[0]*k,(p[1]-cy)*k]);})();
 const heartR2=polyR(heartPts);
 const fanR=th=>{const s=(((4*up(th))/TAU)%1+1)%1;return 24+28*Math.pow(s,.95);};   /* four swept blades, a pinwheel */
 const SHAPES=[
  ()=>50,                                         /* circle */
  flowerR,                                        /* flower */
  heartR2,                                        /* heart */
  cloverR,                                        /* clover */
  th=>stadium(th,58,31),                          /* pill */
  fanR,                                           /* fan */
  polyR([[0,-56],[42,0],[0,56],[-42,0]]),         /* diamond */
  polyR(Array.from({length:10},(_,k)=>{const an=-Math.PI/2+k*Math.PI/5,r=k%2?25:56;return [Math.cos(an)*r,Math.sin(an)*r+4];}))   /* five-point star */
 ];
 /* a [1 2 1] pass round the ring, repeated, takes every tip and cusp off */
 const soften=(R,n)=>{for(let q=0;q<n;q++)R=R.map((_,k)=>(R[(k+NP-1)%NP]+2*R[k]+R[(k+1)%NP])/4);return R;};
 const ENTRY=SHAPES.map(f=>soften(Array.from({length:NP},(_,k)=>f(TH(k))),2));   /* two passes only: enough to round the tips, not enough to melt the silhouette */
 const finalPts=(a,b,n)=>Array.from({length:NP},(_,k)=>supR(TH(k),a,b,n));
 /* Soft candy body: the outline wobbles like jelly (two slow lobes, 2 and 3 around the ring) and the amount follows a damped ring-down after each hit. */
 function blob(A,B,m,col,jig=0,ph=0){c.fillStyle=col;c.beginPath();for(let k=0;k<NP;k++){const th=TH(k),f=1+jig*(.6*Math.sin(2*th+ph)+.4*Math.sin(3*th-ph*1.3)),r=mix(A[k],B[k],m)*f;const x=r*Math.cos(th),y=r*Math.sin(th);if(k)c.lineTo(x,y);else c.moveTo(x,y);}c.closePath();c.fill();}
 const ring=(t,t0,amp)=>t<t0?0:amp*Math.exp(-(t-t0)*4.2)*Math.sin((t-t0)*21);
 /* one crisp rebound: it dies away about twice as fast and swings once, not three times */
 const snap=(t,t0,amp)=>t<t0?0:amp*Math.exp(-(t-t0)*9)*Math.sin((t-t0)*14);
 // A modular rosette: pieces fly in from far outside, stretch while they travel, squash when they land, and the shapes blend between pill, square and circle.
 /* which shapes jump during the hold: three picked at random once (not per frame, so scrubbing and recording stay exact), one at a time */
 const JUMPS=(()=>{const pick=[];while(pick.length<3){const k=Math.floor(Math.random()*8);if(!pick.includes(k))pick.push(k);}return [[2.95,pick[0]],[3.25,pick[1]],[3.55,pick[2]]];})();
 // ARRIVE, three beats, one hero idea in each.
 //   COME  (0 - 1.5s)   eight shapes land pair by pair (each pair presses together once), slim into blades and spin down, and are drawn into one ball.
 //   CHANGE (1.5 - 3.8s) the ball swallows (dips, then swells) and bursts open into six clear shapes; they turn upright and hold still for a beat.
 //   GO    (3.8 - 5s)   one press, back to circles, and out along the way they came.
 // One curve family throughout: ease-out in with about 10-15% overshoot, ease-in out, and a single rebound per impact. Only the outer circle runs underneath.
 function arrive(t){
  const enter=bezier(.22,1.5,.38,1),bloomE=bezier(.3,1.4,.45,1),burstE=bezier(.28,1.75,.4,1),leave=bezier(.55,0,.85,.35);
  const settle=seg(t,.28,1.55,out),unfold=seg(t,1.84,2.62,burstE)*(1-seg(t,3.8,4.7,inout));
  const returnHome=seg(t,4.04,4.9,standard),s2=settle*(1-returnHome);
  /* COME: the ring slims to blades and turns half a turn, fast at first and easing to nothing; it is drawn in while it is still slowing */
  const spinG=(1-Math.pow(1-seg(t,.84,1.34,x=>x),2))*Math.PI,thin=seg(t,.84,.97,out)*(1-seg(t,1.72,1.84,inout));
  const grp=-.1-1.2*(1-s2)+spinG;
  c.save();c.translate(W/2,H/2-8);c.rotate(grp);
  const sq=seg(t,3.8,4.04,inout)*(1-seg(t,4.04,4.2,out));
  const ball=seg(t,1.0,1.55,inout)*(1-seg(t,1.76,2.15,burstE));   /* the gathering starts 0.13s earlier, so the last pair has barely landed when the blades are already being drawn in */
  /* CHANGE: a breath in, the ball shrinks as it goes down, then swells hard just before it bursts */
  const inhale=bell(t,.8,.9,1.0,out),dip=seg(t,1.5,1.58,inout)*(1-seg(t,1.67,1.7,out)),pop=bell(t,1.68,1.74,1.86,out),breath=1+.12*inhale-.3*dip+.5*pop;   /* the ball is squeezed small and held for an instant before it is let go: that is where the tension is */
  const suck=bell(t,.98,1.28,1.56,inout);
  const stand=seg(t,2.1,2.65,out)*(1-seg(t,3.8,4.2,inout));          /* the shapes turn upright and stay that way for the hold */
  const drift=seg(t,2.65,3.85,inout);                                   /* the hold is not frozen: the shapes ease slowly outward */
  const radius=(mix(188,108,s2)+unfold*72+drift*24-sq*62)*(1-clamp(ball));
  c.scale((1-sq*.1)*breath,(1-sq*.1)*breath);
  for(let i=0;i<8;i++){
   const lag=(i>>1)*.05+(i%2)*.02;
   const a=seg(t,.25+lag,.95+lag,enter)*(1-seg(t,4.05+lag,4.95,leave));
   const fly=clamp(1-a),morph=seg(t,.35+lag,1.0+lag,out)*(1-seg(t,4.55+lag*.5,4.95,standard));
   /* pairs (0-1, 2-3 ...) close in, press flat against each other once as they land, and ease back */
   const tp=.94+(i>>1)*.05,near=clamp((a-.72)/.28);
   const press=near*bell(t,tp-.16,tp,tp+.2,out),hit=press*.1*(i%2?-1:1);
   const upright=-(grp+i*TAU/8+hit);                                     /* the turn that cancels the ring's own, so the shape stands straight */
   let jump=0;for(const [tj,ij] of JUMPS)if(ij===i)jump+=bell(t,tj-.04,tj+.08,tj+.34,out);   /* one shape at a time pops up and settles */
   const lean=seg(t,.98,1.2,out)*(1-clamp(ball));                       /* from about 1.1s the blades lean over and swing inward on a curve, not straight down their spokes */
   c.save();c.rotate(i*TAU/8+hit+clamp(ball)*.9);c.translate(0,-(radius+fly*fly*640));
   c.rotate(mix(mix(-1.3,0,a)*(1-clamp(ball))+lean*.85,upright,stand));
   const s=mix(.15,1,a)*(1-sq*.12)*(1+.3*jump),sx0=s*(1-fly*.1-press*.3-suck*.3)*(1+.1*unfold)*(1-.78*thin),sy0=s*(1+fly*.3+press*.2+suck*.75),sx=mix(sx0,s,clamp(ball)),sy=mix(sy0,s,clamp(ball));
   c.scale(sx,sy);
   const fin=i%2?finalPts(55,55,mix(3.2,2,clamp(unfold))):finalPts(mix(56,52,ball),mix(66,52,ball),mix(2.5,2,clamp(unfold*.6+ball)));
   const bloom=ENTRY[(i+4)%8],u=clamp(unfold),fin2=fin.map((q,k)=>mix(q,bloom[k],u));
   const bc=Math.max(clamp(ball),seg(t,3.95,4.5,inout)*(1-seg(t,4.55,4.95,standard))),circ=ENTRY[0];
   const jig=(snap(t,1.9+lag*.3,.2)+snap(t,4.5,.1))*(1-clamp(ball))*(1-seg(t,4.6,4.95));
   blob(ENTRY[i],fin2.map((q,k)=>mix(q,circ[k]*(1.16-.32*clamp(ball)),bc)),Math.max(morph,bc),mixHex(SITE[i],BLUE,clamp(ball)),jig,i*1.7);
   c.restore();
  }
  dot(0,0,(24+unfold*16)*(1-clamp(ball*1.6)),BLUE);c.restore();
  /* the circle sits just outside the outermost shapes and moves with them: out as they bloom and drift, in with the press, away as they leave */
  const ORs=Math.max((radius+82)*breath*(1-sq*.1),104);
  const draw=seg(t,.75,1.55)*(1-seg(t,4.05,4.95));                       /* the outer circle draws itself in and out, with its small orbiting balls */
  c.strokeStyle=PALE;c.lineWidth=2;c.beginPath();c.arc(W/2,H/2-8,ORs,-Math.PI/2,-Math.PI/2+TAU*draw);c.stroke();
  for(let k=5;k>=0;k--){const tt=t-k*.035;c.save();c.translate(W/2,H/2-8);c.rotate(TAU*tt/5);c.globalAlpha=1-k*.17;dot(0,-ORs,5*(1-k*.1)+unfold*3,k?PALE:BLUE);c.restore();}
  c.globalAlpha=1;
  stamp(1,'ARRIVE','Many parts. One point of view.',t);
 }
 // A folded fan snaps open past its mark, spins, and settles; the orange satellite drags a comet tail and the rings pulse outward.
 function release(t){
  const open=seg(t,.25,1.25,out)*(1-seg(t,3.6,4.7,inout));
  const turn=seg(t,1.6,3.1,inout)*TAU*1.5*(1-seg(t,3.7,4.9,inout));
  const kick=bell(t,.3,.55,1.2,out);
  c.save();c.translate(W/2,H/2-6);c.rotate(turn-.12);c.scale(1+kick*.06,1-kick*.06);
  for(let i=12;i>=0;i--){
   const local=seg(t,.25+i*.035,1.15+i*.035,strong)*(1-seg(t,3.6+i*.025,4.95,inout));
   c.save();c.rotate(mix(-.08,.16+i*.405,local));
   const r=mix(75,245,local),pulse=1+.3*Math.sin(i*.9+turn*2)*clamp(local),wide=mix(28,58,clamp(local))*pulse;
   const stretch=1+Math.abs(local-clamp(local))*.5;
   rr(-wide/2,-r,wide,Math.max(wide,(r-45)*stretch),wide/2,i%3===0?PALE:BLUE);c.restore();
  }
  const core=60+bell(t,.4,.7,1.3,out)*26;dot(0,0,core,BLUE);dot(0,0,29+bell(t,.5,.8,1.4,out)*10,PAPER);c.restore();
  const orbit=seg(t,.75,1.55,out)*(1-seg(t,3.35,4.55,inout));
  for(let k=10;k>=0;k--){
   const tt=t-k*.045,o=seg(tt,.75,1.55,out)*(1-seg(tt,3.35,4.55,inout)),ang=-Math.PI/2+TAU*seg(tt,.7,3.9,inout);
   c.globalAlpha=k?.42*(1-k/11):1;
   dot(W/2+Math.cos(ang)*310*o,H/2-6+Math.sin(ang)*310*o,(18-k*1.1)*Math.max(o,0),ORANGE);
  }
  c.globalAlpha=1;
  const halo=bell(t,.75,1.5,4.5,inout);c.globalAlpha=halo*.5;c.strokeStyle=BLUE;c.lineWidth=1.5;c.beginPath();c.arc(W/2,H/2-6,310,0,TAU);c.stroke();
  for(let k=0;k<3;k++){const pr=seg(t,.4+k*.18,1.7+k*.18,out)*(1-seg(t,1.7+k*.18,2.3+k*.18,standard));c.globalAlpha=.35*pr;c.lineWidth=3;c.beginPath();c.arc(W/2,H/2-6,80+seg(t,.4+k*.18,1.7+k*.18,out)*260,0,TAU);c.stroke();}
  c.globalAlpha=1;
  stamp(2,'RELEASE','Open quickly. Leave room to breathe.',t);
 }
 // Two counter-moving fields blend between a sine ribbon and a zig-zag ribbon on every pass; the comet dots drag a trail.
 function exchange(t){
  const p=t/5,phase=TAU*p,breath=(1-Math.cos(phase))/2,morph=Math.pow(Math.sin(phase*2)*.5+.5,1.5);
  c.save();c.translate(W/2,H/2-6);c.lineCap='round';c.lineJoin='round';
  for(let j=0;j<21;j++){
   const z=j/20,offset=mix(-150,150,z),amp=170+breath*110;
   c.beginPath();for(let i=0;i<=240;i++){
    const u=i/240,xx=mix(-460,460,u),env=Math.pow(Math.sin(Math.PI*u),.8);
    const wave=mix(Math.sin(u*TAU+phase),tri(u*TAU+phase)*1.08,morph);
    const yy=wave*amp*env+offset*Math.cos(u*TAU/2+phase)+Math.sin(u*TAU*3+phase*2+z*3)*38*breath*env;
    if(i)c.lineTo(xx,yy);else c.moveTo(xx,yy);
   }
   c.strokeStyle=j===10?ORANGE:(j<10?BLUE:'#58b6ce');c.lineWidth=j===10?7:2+3*Math.sin(Math.PI*z)*(.4+breath);c.stroke();
  }
  for(const sign of [-1,1])for(let k=7;k>=0;k--){
   const ph=phase-k*.07,x=sign*Math.cos(ph)*372,y=sign*Math.sin(ph)*120;c.globalAlpha=k?.4*(1-k/8):1;dot(x,y,(15-k)*(1+.35*breath),BLUE);if(!k){c.globalAlpha=1;dot(x,y,5,PAPER);}
  }
  c.globalAlpha=1;c.restore();
  stamp(3,'EXCHANGE','Different directions. The same rhythm.',t);
 }
 // An elastic stack transfers an impact downwards; the hero stretches in the air, flattens into a rounded rectangle on every hit, and bounces three times.
 function rebound(t){
  const floor=H/2+196,cx=W/2,hits=[[1.15,1],[2.55,.55],[3.2,.28]];
  line(cx-265,floor+8,cx+265,floor+8,'#c8cec6',2);
  const yAt=u=>{
   if(u<.22)return -172-(.22-u)*0+0;
   if(u<1.15){const f=seg(u,.22,1.15,x=>x*x*x);return mix(-172,59,f);}
   if(u<2.55){const b=(u-1.15)/1.4;return 59-300*4*b*(1-b);}
   if(u<3.2){const b=(u-2.55)/.65;return 59-110*4*b*(1-b);}
   if(u<3.48)return 59;
   const rise=seg(u,3.48,4.88,inout);return mix(59,-172,rise);
  };
  const y=yAt(t),vy=(yAt(t+.012)-yAt(t-.012))/.024;
  let impact=0;for(const [h,a] of hits)impact+=bell(t,h-.03,h+.05,h+.45,out)*a;impact=Math.min(1,impact);
  for(let i=0;i<4;i++){
   let wave=0;for(const [h,a] of hits)wave+=seg(t,h+.03+i*.085,h+.19+i*.085,out)*(1-seg(t,h+.19+i*.085,h+.85+i*.085,spring))*a;
   const base=floor-i*29;
   rr(cx-145-wave*34,base-23,290+wave*68,22-wave*8,11,i%2?PALE:BLUE);
  }
  for(const [h,a] of hits){const rp=seg(t,h,h+.8,out)*(1-seg(t,h+.5,h+1,standard));if(rp>0){c.globalAlpha=.4*rp*a;c.strokeStyle=BLUE;c.lineWidth=3;c.beginPath();c.ellipse(cx,floor+6,70+rp*230*a,(70+rp*230*a)*.13,0,0,TAU);c.stroke();c.globalAlpha=1;}}
  const lift=clamp((59-y)/360);c.save();c.globalAlpha=.1+.2*(1-lift);c.translate(cx,floor+6);c.scale(1,.13);dot(0,0,74+lift*20+impact*18,INK);c.restore();
  const stretch=clamp(Math.abs(vy)/2400)*.5;
  c.save();c.translate(cx,y+H/2-45);
  const sx=1+impact*.5-stretch*.5,sy=1-impact*.46+stretch;c.scale(sx,sy);
  const w=144,r=mix(72,34,impact);pill(w,w,r,BLUE);dot(-24,-23,14,PALE);c.restore();
  const kick=bell(t,1.21,1.64,3.65,inout);dot(cx+mix(190,250,kick),H/2+mix(106,-46,kick),18+impact*5,ORANGE);
  stamp(4,'REBOUND','A little resistance makes it feel real.',t);
 }
 // A fixed alphabet forms a ring. Perspective and light move; the print never flickers.
 const glyphs=['#','/','[]','*','●','▲','⬡','+','{}'];
 const glyphRing=[];
 for(let row=-15;row<=15;row++)for(let col=-15;col<=15;col++){
  const x=col*28+(row%2?14:0),y=row*24.25;
  const radius=Math.hypot(x,y);
  if(radius>163&&radius<277){
   const hash=Math.abs(col*31+row*71+col*row*13);
   glyphRing.push({x,y,glyph:glyphs[hash%glyphs.length],edge:Math.min((radius-163)/24,(277-radius)/24,1),hash});
  }
 }
 function glyphOrbit(t){
  const phase=TAU*t/5,angle=Math.sin(phase)*.12,tilt=Math.sin(phase)*.12;
  c.save();c.translate(W/2,H/2-6);c.rotate(angle);
  c.textAlign='center';c.textBaseline='middle';
  c.font='600 25px ui-monospace, Consolas, monospace';
  glyphRing.forEach(p=>{
   const depth=p.x/277;
   const perspective=1+depth*tilt*.32;
   c.globalAlpha=.35+.65*p.edge;
   c.fillStyle=p.hash%7===0?INK:p.hash%4===0?'#58b6ce':BLUE;
   c.fillText(p.glyph,p.x*perspective,p.y*perspective);
  });
  c.globalAlpha=1;c.restore();
  stamp(5,'GLYPH ORBIT','An alphabet becomes a shape.',t);
 }
 const draws=[arrive,release,exchange,rebound,glyphOrbit];
 return function(index,time,width,height){
  c.save();c.clearRect(0,0,width,height);
  if(miniature){const scale=Math.min(width/1000,height/760);c.translate(width/2,height/2);c.scale(scale,scale);c.translate(-W/2,-H/2);}
  else{c.fillStyle=PAPER;c.fillRect(0,0,W,H);guides();}
  draws[index](time);c.restore();
 };
}};



