window.MotionStudies = { create: function(c, miniature) {
 'use strict';

 const W=1440,H=810,TAU=Math.PI*2,BLUE='#0085b5',INK='#22231f',PAPER='#f3f2ed',PALE='#aadce6',ORANGE='#f37e53';
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
 // A modular rosette: separate shapes close into a shared, negative-space centre.
 function arrive(t){
  const settle=seg(t,.28,1.55,standard),unfold=seg(t,2.05,3.05,inout)*(1-seg(t,3.75,4.7,inout));
  const returnHome=seg(t,4.04,4.9,standard);
  c.save();c.translate(W/2,H/2-8);c.rotate(-.1+.1*settle*(1-returnHome)+unfold*Math.PI/4);
  const radius=mix(188,108,settle)*(1-returnHome)+188*returnHome+unfold*42;
  for(let i=0;i<8;i++){
   const lag=(i%4)*.075;const a=seg(t,.25+lag,1.45+lag,standard)*(1-seg(t,4.05+lag,4.95,standard));
   c.save();c.rotate(i*TAU/8);c.translate(0,-radius);c.rotate(mix(-.4,0,a)+unfold*.22);
   const s=mix(.62,1,a);c.scale(s,s);
   if(i%2===0){rr(-56,-66,112,132,56,i===0?ORANGE:BLUE);}else{rr(-55,-55,110,110,24,BLUE);}
   c.restore();
  }
  dot(0,0,24+unfold*9,PAPER);c.restore();
  const draw=seg(t,.75,1.55)*(1-seg(t,4.05,4.95));c.strokeStyle=PALE;c.lineWidth=2;c.beginPath();c.arc(W/2,H/2-8,260,-Math.PI/2,-Math.PI/2+TAU*draw);c.stroke();
  c.save();c.translate(W/2,H/2-8);c.rotate(TAU*t/5);dot(0,-260,5,BLUE);c.restore();
  stamp(1,'ARRIVE','Many parts. One point of view.',t);
 }
 // A folded fan releases into a spacious radial system; the outer echo lands later.
 function release(t){
  const open=seg(t,.25,1.25,out)*(1-seg(t,3.6,4.7,inout));
  const turn=seg(t,1.6,3.1,inout)*TAU*(1-seg(t,3.7,4.9,inout));
  c.save();c.translate(W/2,H/2-6);c.rotate(turn-.12);
  for(let i=12;i>=0;i--){
   const local=seg(t,.25+i*.035,1.15+i*.035,out)*(1-seg(t,3.6+i*.025,4.95,inout));
   c.save();c.rotate(mix(-.08,.16+i*.405,local));
   const r=mix(75,245,local),wide=mix(28,58,local);
   rr(-wide/2,-r,wide,r-45,wide/2,i%3===0?PALE:BLUE);c.restore();
  }
  dot(0,0,60,BLUE);dot(0,0,29,PAPER);c.restore();
  const orbit=seg(t,.75,1.55,out)*(1-seg(t,3.35,4.55,inout));
  const angle=-Math.PI/2+TAU*seg(t,.7,3.9,inout);
  dot(W/2+Math.cos(angle)*310*orbit,H/2-6+Math.sin(angle)*310*orbit,18*orbit,ORANGE);
  const halo=bell(t,.75,1.5,4.5,inout);c.globalAlpha=halo*.5;c.strokeStyle=BLUE;c.lineWidth=1.5;c.beginPath();c.arc(W/2,H/2-6,310,0,TAU);c.stroke();c.globalAlpha=1;
  stamp(2,'RELEASE','Open quickly. Leave room to breathe.',t);
 }
 // Two counter-moving fields form one continuous woven loop, with precise mirror symmetry.
 function exchange(t){
  const p=t/5,phase=TAU*p,breath=(1-Math.cos(phase))/2;
  c.save();c.translate(W/2,H/2-6);
  for(let j=0;j<21;j++){
   const z=j/20,offset=mix(-132,132,z),amp=150+breath*50;
   c.beginPath();for(let i=0;i<=220;i++){
    const u=i/220,xx=mix(-440,440,u),env=Math.sin(Math.PI*u);
    const yy=Math.sin(u*TAU+phase)*amp*env+offset*Math.cos(u*TAU/2+phase);
    if(i)c.lineTo(xx,yy);else c.moveTo(xx,yy);
   }
   c.strokeStyle=j===10?ORANGE:(j<10?BLUE:'#58b6ce');c.lineWidth=j===10?5:2.5;c.stroke();
  }
  const a=phase*.5;for(const sign of [-1,1]){const x=sign*Math.cos(phase)*352,y=sign*Math.sin(phase)*94;dot(x,y,12,BLUE);dot(x,y,4,PAPER);}
  c.restore();
  stamp(3,'EXCHANGE','Different directions. The same rhythm.',t);
 }
 // An elastic stack transfers an impact downwards; squash is local to the contact.
 function rebound(t){
  const floor=H/2+196,cx=W/2;
  line(cx-265,floor+8,cx+265,floor+8,'#c8cec6',2);
  const fall=seg(t,.22,1.15,inout),rise=seg(t,3.48,4.88,inout);
  let y=mix(-172,59,fall);y=mix(y,-172,rise);
  const impact=bell(t,1.1,1.25,1.65,out),bounce=clamp((t-1.15)/1.3);
  if(t>=1.15&&t<3.48)y=59-150*Math.sin(Math.PI*bounce)*(1-bounce)**2;
  // Echoes are delayed by depth, so the impact reads through the stack.
  for(let i=0;i<4;i++){
   const wave=seg(t,1.18+i*.085,1.34+i*.085,out)*(1-seg(t,1.34+i*.085,2+i*.085,spring));
   const base=floor-i*29;
   rr(cx-145-wave*20,base-23,290+wave*40,22-wave*4,11,i%2?PALE:BLUE);
  }
  const lift=clamp((59-y)/231);c.save();c.globalAlpha=.1+(.18*(1-lift));c.translate(cx,floor+6);c.scale(1, .13);dot(0,0,74+lift*15,INK);c.restore();
  c.save();c.translate(cx,y+H/2-45);c.scale(1+impact*.23,1-impact*.18);dot(0,0,72,BLUE);dot(-24,-23,14,PALE);c.restore();
  // A small warm satellite punctuates the landing, then returns with the hero.
  const kick=bell(t,1.21,1.64,3.65,inout);dot(cx+mix(190,250,kick),H/2+mix(106,-46,kick),18,ORANGE);
  stamp(4,'REBOUND','A little resistance makes it feel real.',t);
 }
 const draws=[arrive,release,exchange,rebound];
 return function(index,time,width,height){
  c.save();c.clearRect(0,0,width,height);
  if(miniature){const scale=Math.min(width/1000,height/760);c.translate(width/2,height/2);c.scale(scale,scale);c.translate(-W/2,-H/2);}
  else{c.fillStyle=PAPER;c.fillRect(0,0,W,H);guides();}
  draws[index](time);c.restore();
 };
}};
