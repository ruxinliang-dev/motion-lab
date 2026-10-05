(() => {
 'use strict';
 const cv=document.getElementById('stage'),c=cv.getContext('2d'),W=1440,H=810;
 const drawStudy=MotionStudies.create(c,false);
 const names=['Arrive','Release','Exchange','Rebound'];
 const descriptions=['A staggered assembly becomes one form, opens into a new arrangement, then finds its way home.','A compact fan opens fast. The smaller satellite and outer echo follow, giving the main form room to settle.','A continuous ribbon changes depth and direction. The opposing sides stay in the same five-second rhythm.','An impact travels through an elastic stack. Local squash, delayed reactions and a soft return give the shapes weight.'];
 let selected=0,time=0,playing=!matchMedia('(prefers-reduced-motion: reduce)').matches,rate=1,last=0,raf=0,recording=false;
 const play=document.getElementById('play'),scrub=document.getElementById('scrub'),speed=document.getElementById('speed'),save=document.getElementById('save');
 function duration(){return 5;}
 function render(){scrub.max=duration();drawStudy(selected,time,W,H);document.getElementById('clock').textContent=`${time.toFixed(2).padStart(5,'0')} / ${duration().toFixed(2).padStart(5,'0')}`;scrub.value=time;}
 function updatePlay(){play.innerHTML=playing?'Pause <span>Ⅱ</span>':'Play <span>▶</span>';play.setAttribute('aria-label',playing?'Pause animation':'Play animation');}
 function frame(now){if(playing){if(last)time=(time+(now-last)/1000*rate)%duration();render();}last=now;raf=requestAnimationFrame(frame);}
 play.addEventListener('click',()=>{if(recording)return;playing=!playing;last=0;updatePlay();});
 scrub.addEventListener('input',()=>{if(recording)return;playing=false;time=Number(scrub.value);updatePlay();render();});
 speed.addEventListener('click',()=>{if(recording)return;rate=rate===1?.5:1;speed.textContent=rate===1?'½ speed':'1× speed';speed.setAttribute('aria-label',rate===1?'Play at half speed':'Play at normal speed');});
 document.querySelectorAll('[data-scene]').forEach(b=>b.addEventListener('click',()=>{
  if(recording)return;selected=Number(b.dataset.scene);time=0;last=0;document.querySelectorAll('[data-scene]').forEach(btn=>{const on=btn===b;btn.classList.toggle('selected',on);btn.setAttribute('aria-pressed',on);});
  document.getElementById('caption').textContent=descriptions[selected];cv.setAttribute('aria-label',`${names[selected]}: looping motion graphic`);render();
 }));
 document.addEventListener('visibilitychange',()=>{last=0;if(document.hidden){cancelAnimationFrame(raf);raf=0;}else if(!raf)raf=requestAnimationFrame(frame);});
 matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change',e=>{if(e.matches){playing=false;updatePlay();}});
 save.addEventListener('click',()=>{
  if(recording)return;
  if(!cv.captureStream||!window.MediaRecorder){save.textContent='Export unavailable';return;}
  const old={playing,time,rate};recording=true;save.disabled=true;save.textContent='Recording…';
  const stream=cv.captureStream(60),chunks=[],mime=MediaRecorder.isTypeSupported('video/webm;codecs=vp9')?'video/webm;codecs=vp9':'video/webm';
  const rec=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:12000000});
  rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  rec.onstop=()=>{const url=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));const a=document.createElement('a');a.href=url;a.download=`ruxin-${names[selected].toLowerCase()}-${duration()}s.webm`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);stream.getTracks().forEach(t=>t.stop());playing=old.playing;time=old.time;rate=old.rate;last=0;recording=false;save.disabled=false;save.innerHTML='Save loop <span>↗</span>';updatePlay();render();};
  time=0;rate=1;playing=true;last=0;render();updatePlay();rec.start();setTimeout(()=>rec.stop(),duration()*1000);
 });
 updatePlay();render();raf=requestAnimationFrame(frame);
})();



