import * as T from '../vendor/three.module.js';
export function createWalkthrough(host){
 const renderer=new T.WebGLRenderer({antialias:true,alpha:false,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio,.95));renderer.setClearColor(0x322719);renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=T.SRGBColorSpace;renderer.domElement.className='walkthrough-canvas';host.append(renderer.domElement);
 const scene=new T.Scene();scene.fog=new T.FogExp2(0x59402b,.023);const camera=new T.PerspectiveCamera(57,1,.1,90);scene.add(new T.HemisphereLight(0xffe0b1,0x35271b,2));const sun=new T.DirectionalLight(0xffd29a,3);sun.position.set(3,8,-18);scene.add(sun);
 const materials=new Map();const mat=(color,roughness=.7,metalness=0)=>{const key=[color,roughness,metalness].join();if(!materials.has(key))materials.set(key,new T.MeshStandardMaterial({color,roughness,metalness}));return materials.get(key)};const stone=mat(0x867053),wood=mat(0x322218),edge=mat(0x5c4228),brass=mat(0xa47b3e,.32,.7),dark=mat(0x171b17),cream=mat(0xc9b58d);
 const grainCanvas=document.createElement('canvas');grainCanvas.width=128;grainCanvas.height=128;const gc=grainCanvas.getContext('2d');gc.fillStyle='#c4bdaa';gc.fillRect(0,0,128,128);for(let i=0;i<128;i++){const v=155+Math.floor(35*Math.sin(i*1.7)+18*Math.sin(i*.23));gc.strokeStyle=`rgba(${v},${v},${v},.38)`;gc.beginPath();gc.moveTo(i,0);gc.bezierCurveTo(i+3,35,i-2,80,i+1,128);gc.stroke()}const grainTexture=new T.CanvasTexture(grainCanvas);grainTexture.colorSpace=T.SRGBColorSpace;grainTexture.wrapS=grainTexture.wrapT=T.RepeatWrapping;wood.map=grainTexture;edge.map=grainTexture;
const boxGeometry=new T.BoxGeometry(1,1,1);function box(x,y,z,sx,sy,sz,m){const o=new T.Mesh(boxGeometry,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);scene.add(o);return o}
 // Repeated tile joints and subtle stone variation provide floor depth without external textures.
 for(let row=0;row<22;row++)for(let col=0;col<8;col++){box((col-3.5)*1.4,-.05,12-row*1.4,1.39,.1,1.39,mat([0x70604b,0x796954,0x82715b,0x74654f][(row*3+col)%4],.38))}
 box(-5.7,3,-3,.4,6,35,stone);box(5.7,3,-3,.4,6,35,stone);box(0,6.7,-3,12,.2,35,wood);
 for(const z of [8,2,-4,-10,-16]){
  for(const x of [-4.7,4.7]){box(x,2.2,z,.48,4.4,.65,stone);box(x,.18,z,.75,.36,.85,edge);box(x,4.25,z,.8,.25,.9,stone)}
  const arch=new T.Mesh(new T.TorusGeometry(4.7,.24,8,48,Math.PI),stone);arch.position.set(0,4.25,z);arch.scale.y=.48;scene.add(arch);
  box(0,6.4,z,11,.25,.35,wood);
  const glow=new T.MeshStandardMaterial({color:0xffd7a0,emissive:0xffb952,emissiveIntensity:2});const lamp=new T.Mesh(new T.CylinderGeometry(.23,.3,.62,8),glow);lamp.position.set(0,4.9,z);scene.add(lamp);box(0,5.7,z,.035,1,.035,brass);for(const yy of [4.56,5.23])box(0,yy,z,.6,.08,.6,brass);
  for(const xx of [-.23,.23])for(const zz of [-.23,.23])box(xx,4.9,z+zz,.025,.7,.025,brass);
  const light=new T.PointLight(0xffba68,22,9,2);light.position.set(0,4.7,z);scene.add(light);
 }
 const colors=[0x8d5630,0x96834d,0xa6a17b,0x777c51,0xb0a17d,0x704329];const goods=colors.map(c=>mat(c));const jarGeometry=new T.CylinderGeometry(.105,.11,.32,10);const capGeometry=new T.CylinderGeometry(.108,.108,.04,10);const label=mat(0xc9b98d);
 for(const side of [-1,1])for(const z of [5,-.5,-6,-11.5]){
  box(side*5.12,2,z,.3,3.7,4.8,wood);for(const zz of [z-2.3,z+2.3])box(side*4.75,2,zz,.95,3.85,.12,edge);
  for(let row=0;row<4;row++){const y=.65+row*.85;box(side*4.75,y,z,1,.09,4.6,edge);for(let k=0;k<11;k++){const zz=z-2+k*.39;const m=goods[(k+row)%6];if((k+row)%3===0){box(side*4.68,y+.26,zz,.34,.44,.26,m);box(side*4.49,y+.25,zz,.01,.19,.19,label)}else{const jar=new T.Mesh(jarGeometry,m);jar.position.set(side*4.65,y+.22,zz);scene.add(jar);const cap=new T.Mesh(capGeometry,brass);cap.position.set(side*4.65,y+.4,zz);scene.add(cap)}}}
 }
 // Produce islands sit outside the clear camera path.
 const fruitGeometry=new T.SphereGeometry(.115,10,8);const fruitMats=[mat(0xc58532),mat(0x858b3c),mat(0x9d402b)];
 for(const [x,z] of [[-2.8,3],[2.8,-3],[-2.8,-8]]){box(x,.6,z,1.4,1.2,1.9,wood);box(x,1.23,z,1.6,.13,2.1,edge);for(let a=0;a<4;a++)for(let b=0;b<6;b++){const fruit=new T.Mesh(fruitGeometry,fruitMats[b%3]);fruit.position.set(x-.48+a*.3,1.4,z-.75+b*.29);scene.add(fruit)}for(const xx of [-.7,.7])box(x+xx,1.42,z,.08,.32,2,edge)}
 box(1.4,.65,-14,4,1.3,1.35,wood);box(1.4,1.34,-14,4.2,.12,1.5,cream);box(2,1.55,-14,.12,.45,.15,brass);const screen=box(2,1.93,-14,.95,.64,.06,dark);screen.rotation.x=-.15;const sc=document.createElement('canvas');sc.width=512;sc.height=320;const c=sc.getContext('2d');c.fillStyle='#182c25';c.fillRect(0,0,512,320);c.fillStyle='#dac699';c.font='28px Georgia';c.fillText('A1 TRADERS',28,48);c.font='15px Arial';c.fillText('Your counter. Your pace.',28,78);for(let i=0;i<3;i++){c.fillStyle='#34483c';c.fillRect(28+i*112,110,95,95)}c.fillStyle='#c7b384';c.fillRect(28,246,450,40);const texture=new T.CanvasTexture(sc);texture.colorSpace=T.SRGBColorSpace;const screenFace=new T.Mesh(new T.PlaneGeometry(.88,.55),new T.MeshBasicMaterial({map:texture}));screenFace.position.set(2,1.93,-13.958);scene.add(screenFace);
 const back=new T.TextureLoader().load('assets/heritage-store-v23.png',()=>{back.colorSpace=T.SRGBColorSpace;render(lastProgress,true)});const backdrop=new T.Mesh(new T.PlaneGeometry(13,8),new T.MeshBasicMaterial({map:back}));backdrop.position.set(0,3.7,-20);scene.add(backdrop);
 // Batch repeated architecture and stock so the aisle stays inexpensive to render.
const batches=new Map();for(const child of [...scene.children]){if(!child.isMesh)continue;const key=child.geometry.uuid+child.material.uuid;if(!batches.has(key))batches.set(key,[]);batches.get(key).push(child)}for(const list of batches.values()){if(list.length<3)continue;const instanced=new T.InstancedMesh(list[0].geometry,list[0].material,list.length);list.forEach((mesh,i)=>{mesh.updateMatrix();instanced.setMatrixAt(i,mesh.matrix);scene.remove(mesh)});instanced.instanceMatrix.needsUpdate=true;scene.add(instanced)}
let lastProgress=0,smooth=0,ready=true;const target=new T.Vector3();
 function resize(){const w=host.clientWidth,h=host.clientHeight;renderer.setSize(w,h,false);camera.aspect=w/h;camera.fov=w<650?78:57;camera.updateProjectionMatrix()}
 function render(p,instant=false){if(!ready)return;lastProgress=p;smooth=instant?p:smooth+(p-smooth)*.09;const mobile=host.clientWidth<650;const x=Math.sin(smooth*Math.PI*2)*(mobile?.35:.65);camera.position.set(x,mobile?2.45:2.25+Math.sin(smooth*Math.PI)*.08,(mobile?12:11)-smooth*21);target.set(x*.2+smooth*.6,mobile?2.1:2.5,-19);camera.lookAt(target);renderer.render(scene,camera);host.classList.add('walkthrough-ready')}
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();ready=false;host.classList.remove('walkthrough-ready');renderer.domElement.remove()});resize();render(0,true);return{render,resize};
}

