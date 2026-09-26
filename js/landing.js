import * as THREE from '../vendor/three.module.js';
import {db} from './core.js';
const reduced=matchMedia('(prefers-reduced-motion: reduce)'),host=document.querySelector('#ambient');
let paused=reduced.matches,visible=true,frame=0,renderer,scene,camera,material,time=0,last=0;
const toggle=document.querySelector('#motion-toggle');
function requestFrame(){if(!frame&&visible&&!document.hidden)frame=requestAnimationFrame(draw)}
function draw(now){frame=0;if(!renderer)return;if(!paused){time+=last?Math.min((now-last)/1000,.05):0;material.uniforms.uTime.value=time}last=now;renderer.render(scene,camera);if(!paused)requestFrame()}
function resize(){if(!renderer)return;const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);material.uniforms.uAspect.value=w/h;requestFrame()}
function syncMotion(){document.body.classList.toggle('motion-paused',paused);toggle.innerHTML=paused?'Resume motion <span>▷</span>':'Pause motion <span>Ⅱ</span>';toggle.setAttribute('aria-pressed',String(paused));last=0;requestFrame()}
toggle.addEventListener('click',()=>{paused=!paused;syncMotion()});reduced.addEventListener('change',()=>{paused=reduced.matches;syncMotion()});
try{
 renderer=new THREE.WebGLRenderer({antialias:false,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,1.25));host.append(renderer.domElement);scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
 material=new THREE.ShaderMaterial({uniforms:{uTime:{value:0},uAspect:{value:1}},vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`,fragmentShader:`precision mediump float;varying vec2 vUv;uniform float uTime;uniform float uAspect;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}
 float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*noise(p);p=p*2.03+2.7;a*=.5;}return v;}
 void main(){vec2 p=vUv;float t=uTime*.045;vec2 q=vec2(fbm(p*2.8+vec2(t,-t)),fbm(p*3.1+vec2(-t,t)+4.));float n=fbm(p*3.+q*2.8+vec2(t,0.));float wave=sin(p.y*6.+q.x*3.+t)*.1;float amber=exp(-pow((p.x-.02-wave)*2.8,2.))* (.27+n*.7);float blue=exp(-pow((p.x-.98+wave)*2.8,2.))*(.3+n*.75);vec3 c=vec3(.028,.034,.047)+vec3(.42,.20,.075)*amber+vec3(.065,.20,.42)*blue;float center=1.-exp(-pow((p.x-.5)*3.5,2.));c*=.65+center*.55;float edge=smoothstep(0.,.18,p.y)*smoothstep(0.,.08,1.-p.y);c=mix(vec3(.031,.035,.047),c,edge);float grain=(hash(gl_FragCoord.xy)-.5)*.022;c+=grain;gl_FragColor=vec4(c,1.);}`});scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),material));resize();
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();cancelAnimationFrame(frame);frame=0;renderer=null;host.replaceChildren()});
}catch(e){console.info('Ambient lighting uses the CSS fallback on this device.');host.replaceChildren();renderer=null}
addEventListener('resize',resize);new IntersectionObserver(([entry])=>{visible=entry.isIntersecting;last=0;if(visible)requestFrame()}).observe(host);document.addEventListener('visibilitychange',()=>{last=0;requestFrame()});syncMotion();
const revealObserver=new IntersectionObserver(entries=>{entries.forEach(entry=>{if(entry.isIntersecting){entry.target.classList.add('visible');revealObserver.unobserve(entry.target)}})},{threshold:.08});document.querySelectorAll('.reveal').forEach(el=>revealObserver.observe(el));document.body.classList.add('js-motion');
const cards=[...document.querySelectorAll('.tool-card')];document.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{const filter=button.dataset.filter;let count=0;document.querySelectorAll('[data-filter]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));cards.forEach(card=>{card.hidden=filter!=='all'&&card.dataset.category!==filter;if(!card.hidden){count++;card.classList.add('visible')}});document.querySelector('#result-count').textContent=`${count} connected tools`;}));
const dashboard=document.querySelector('[data-tilt]');dashboard.addEventListener('pointermove',event=>{if(paused||event.pointerType!=='mouse'||innerWidth<1000)return;const r=dashboard.getBoundingClientRect(),x=(event.clientX-r.left)/r.width-.5,y=(event.clientY-r.top)/r.height-.5;dashboard.style.transform=`rotateX(${4-y*3}deg) rotateY(${x*4}deg)`});dashboard.addEventListener('pointerleave',()=>{dashboard.style.transform=''});
Dexie.liveQuery(()=>db.settings.get('preferences')).subscribe({next:row=>{const store=row?.value?.store||'A1 TRADERS';document.querySelectorAll('[data-store-name]').forEach(el=>el.textContent=store)},error:()=>{}});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./sw.js').catch(()=>{});
