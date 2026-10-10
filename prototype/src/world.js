import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

export function createWorld(container, select) {
 const scene = new T.Scene();
 const renderer = new T.WebGLRenderer({antialias:true,alpha:true});
 renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=T.PCFSoftShadowMap; renderer.setClearColor(0xf3efe5,0); container.append(renderer.domElement);
 const camera=new T.PerspectiveCamera(34,1,.1,100); camera.position.set(15,13,17);
 const controls=new OrbitControls(camera,renderer.domElement); controls.target.set(0,.2,0); controls.enableDamping=true; controls.minDistance=9;controls.maxDistance=30;controls.maxPolarAngle=Math.PI/2.2;
 scene.add(new T.HemisphereLight(0xfffaf0,0x777c55,2.8));
 const sun=new T.DirectionalLight(0xfff0d5,4);sun.position.set(-6,14,8);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-12,right:12,top:12,bottom:-12});sun.shadow.normalBias=.035;scene.add(sun);
 const mat=(color,roughness=.85)=>new T.MeshStandardMaterial({color,roughness});
 const soil=mat(0x9a7150),dark=mat(0x283b32),ivory=mat(0xeee7cc),rubber=mat(0x252c29),green=mat(0x56883b),leaflight=mat(0x86a94e),orange=mat(0xc27349),teal=mat(0x4e9287);
 function box(w,h,d,m,x=0,y=0,z=0,parent=scene){const o=new T.Mesh(new T.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 function cyl(r,h,m,x,y,z,parent=scene,r2=r){const o=new T.Mesh(new T.CylinderGeometry(r,r2,h,16),m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;}
 box(11,.6,8,soil,0,-.4,0);box(11.05,.16,8.05,mat(0xb5926a),0,-.78,0);box(10.95,.3,7.95,mat(0x705440),0,-1,0);
 const ground=new T.Mesh(new T.PlaneGeometry(200,200),new T.ShadowMaterial({opacity:.11}));ground.rotation.x=-Math.PI/2;ground.position.y=-1.2;ground.receiveShadow=true;scene.add(ground);
 function plant(x,z,seed,weed=false){const g=new T.Group();g.position.set(x,.06,z);scene.add(g);cyl(.025,.26,green,0,.12,0,g);for(let l=0;l<(weed?5:4);l++){const a=l*Math.PI*.5+seed;const mesh=new T.Mesh(new T.SphereGeometry(1,7,5),weed?green:l%2?green:leaflight);mesh.scale.set(weed?.095:.13,.045,weed?.25:.29);mesh.position.set(Math.sin(a)*.14,.2+(l%2)*.055,Math.cos(a)*.14);mesh.rotation.set(.3,a,.3);mesh.castShadow=true;g.add(mesh);}return g;}
 for(let row=0;row<6;row++){const z=-3+row*1.2;box(10.3,.12,.63,mat(row%2?0xa88258:0xad895f),0,-.04,z);for(let j=0;j<11;j++)plant(-4.65+j*.92,z,row*11+j);}
 const targets=[];for(let i=0;i<24;i++){const x=-4.5+(i%8)*1.27,z=-2.45+Math.floor(i/8)*2.1;const p=plant(x,z,90+i,true);p.userData.target=i;targets.push(p);}
 for(let i=0;i<85;i++){const x=Math.sin(i*97.1)*5.2,z=Math.cos(i*13.7)*3.7;const s=new T.Mesh(new T.DodecahedronGeometry(.04+(i%4)*.013),mat(i%2?0xb99a75:0x806344));s.position.set(x,.01,z);scene.add(s);}

 const robot=new T.Group();scene.add(robot);
 const body=new T.Group();robot.add(body);
 box(1.5,.22,2.05,dark,0,.5,0,body);box(1.48,.36,1.85,ivory,0,.76,0,body);box(1.1,.035,1.2,mat(0xc4c8ae),0,.96,.05,body);box(.8,.015,.04,dark,0,.985,.3,body);
 for(let i=0;i<5;i++)box(.45,.012,.025,dark,0,.99,-.3+i*.075,body);
 const wheelsP=[],spinningP=[];
 for(const side of [-1,1])for(let i=0;i<4;i++){
  const assembly=new T.Group();assembly.position.set(side*.91,.27,-.84+i*.56);body.add(assembly);
  box(.32,.085,.1,dark,-side*.1,.13,0,assembly);
  const wheel=new T.Group();assembly.add(wheel);spinningP.push(wheel);
  cyl(.27,.22,rubber,0,0,0,wheel).rotation.z=Math.PI/2;
  cyl(.12,.235,ivory,0,0,0,wheel).rotation.z=Math.PI/2;
  for(let t=0;t<12;t++){const a=t*Math.PI/6;box(.24,.055,.07,rubber,0,Math.sin(a)*.26,Math.cos(a)*.26,wheel).rotation.x=-a;}
  wheelsP.push(assembly);
 }
 box(.08,.55,.08,dark,0,1,-.84,body);box(.35,.18,.22,dark,0,1.25,-.92,body);
 cyl(.07,.04,mat(0x6aafb1,.2),0,1.24,-1.05,body).rotation.x=Math.PI/2;
 const cableP=new T.CatmullRomCurve3([new T.Vector3(.14,1.26,-.89),new T.Vector3(.28,1.05,-.6),new T.Vector3(.32,.94,-.3)]);
 body.add(new T.Mesh(new T.TubeGeometry(cableP,12,.018,6,false),rubber));
 const toolP=new T.Group();body.add(toolP);
 box(.8,.1,.65,orange,0,.15,-1.27,toolP);for(let i=0;i<4;i++)box(.07,.2,.24,dark,-.3+i*.2,.07,-1.5,toolP);
 cyl(.22,.43,teal,.43,1.04,.55,body);box(1.55,.05,.08,dark,0,.32,1.2,body);for(const x of [-.55,.55])cyl(.06,.15,teal,x,.25,1.2,body);
 const scan=new T.Mesh(new T.ConeGeometry(1.1,2,4,1,true),new T.MeshBasicMaterial({color:0xb7d39b,transparent:true,opacity:.09,side:T.DoubleSide,depthWrite:false}));scan.position.set(0,.3,-1.5);robot.add(scan);
 const mist=new T.Group();robot.add(mist);mist.position.set(0,.18,1.2);
 const dropletMaterial=new T.MeshBasicMaterial({color:0x90d4c9,transparent:true,opacity:.65});
 for(let i=0;i<32;i++)mist.add(new T.Mesh(new T.SphereGeometry(.018,5,4),dropletMaterial));
 mist.visible=false;

 let glb=null;const glbNodes={wheels:[],suspensions:[],tool:null,lens:null,nozzle:null};
 new GLTFLoader().load('/models/field-atlas-robot.glb',g=>{
  glb=g.scene;robot.add(glb);body.visible=false;
  const byPrefix=(prefix)=>{const found=[];glb.traverse(o=>{if(o.name.startsWith(prefix))found.push(o);});return found;};
  glbNodes.wheels=byPrefix('Wheel_L').concat(byPrefix('Wheel_R'));glbNodes.suspensions=byPrefix('Suspension_L').concat(byPrefix('Suspension_R'));
  glbNodes.tool=byPrefix('MechanicalTool')[0]||null;glbNodes.lens=byPrefix('USB_camera_enclosure')[0]||byPrefix('Camera_lens')[0]||null;glbNodes.nozzle=byPrefix('Targeted_nozzle')[0]||null;
  for(const s of glbNodes.suspensions)s.userData.baseY=s.position.y;
  if(glbNodes.tool)glbNodes.tool.userData.baseY=glbNodes.tool.position.y;
  glb.updateMatrixWorld(true);
  if(glbNodes.lens){const local=glb.worldToLocal(glbNodes.lens.getWorldPosition(new T.Vector3()));const f=new T.Vector3(local.x,0,local.z).normalize();glb.rotation.y=Math.atan2(f.x,-f.z);}
  if(glbNodes.nozzle){mist.position.copy(robot.worldToLocal(glbNodes.nozzle.getWorldPosition(new T.Vector3())));}
 },undefined,()=>{glb=null;});

 const routeGroup=new T.Group(),marks=new T.Group();scene.add(routeGroup,marks);
 const markGeometry=new T.RingGeometry(.19,.23,24);
 const markMaterials={机械:new T.MeshBasicMaterial({color:0xc27349,side:T.DoubleSide}),喷施:new T.MeshBasicMaterial({color:0x4e9287,side:T.DoubleSide}),跳过:new T.MeshBasicMaterial({color:0xaca48f,side:T.DoubleSide})};
 const markMeshes=targets.map(t=>{const ring=new T.Mesh(markGeometry,markMaterials.跳过);ring.rotation.x=-Math.PI/2;ring.position.copy(t.position);ring.position.y=.13;ring.visible=false;marks.add(ring);return ring;});
 const onboardCamera=new T.PerspectiveCamera(64,1,.08,40);
 const lensPos=new T.Vector3(),robotForward=new T.Vector3(),followTarget=new T.Vector3(),followDesired=new T.Vector3();
 const onboardRenderer=new T.WebGLRenderer({antialias:true});onboardRenderer.setPixelRatio(Math.min(devicePixelRatio,1.5));onboardRenderer.setClearColor(0xc9c6ad);
 onboardRenderer.domElement.setAttribute('aria-label','三维模拟机载视角，非 USB 摄像头画面');
 let cameraHost=null;
 function mountCamera(host){cameraHost=host;if(host){host.prepend(onboardRenderer.domElement);host.dataset.action='巡视';}else onboardRenderer.domElement.remove();}
 let route=[],current=0,lastRecords=[],selected=-1;
 const halo=new T.Mesh(new T.RingGeometry(.32,.35,48),new T.MeshBasicMaterial({color:0xd17a4d,side:T.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.visible=false;scene.add(halo);
 function setRoute(rows=5){for(const child of [...routeGroup.children]){child.geometry.dispose();child.material.dispose();routeGroup.remove(child);}route=[];for(let r=0;r<rows;r++){const z=-2.65+r*5.3/(rows-1);for(let k=0;k<16;k++){route.push(new T.Vector3((r%2?4.6:-4.6)+(r%2?-1:1)*9.2*k/15,.13,z));}}const line=new T.Line(new T.BufferGeometry().setFromPoints(route),new T.LineDashedMaterial({color:0xb56c44,dashSize:.17,gapSize:.1}));line.computeLineDistances();routeGroup.add(line);}
 setRoute();routeGroup.visible=false;
 function ridgeDelta(x,z){const onRidge=Array.from({length:6},(_,i)=>Math.abs(z-(-3+i*1.2))).some(d=>d<.315)&&Math.abs(x)<5.15;return onRidge?.02:-.1;}
 function pose(){
  const spin=current*route.length*.61/.27;
  if(glb){
   robot.updateMatrixWorld(true);
   const tmp=new T.Vector3();
   for(const s of glbNodes.suspensions){s.getWorldPosition(tmp);s.position.y=s.userData.baseY+ridgeDelta(tmp.x,tmp.z);}
   for(const w of glbNodes.wheels)w.rotation.x=spin;
   if(glbNodes.tool)glbNodes.tool.position.y=glbNodes.tool.userData.baseY+toolStroke;
  }else{
   robot.updateMatrixWorld(true);
   for(const w of wheelsP){const world=robot.localToWorld(new T.Vector3(w.position.x,0,w.position.z));w.position.y=.27+ridgeDelta(world.x,world.z)-robot.position.y;}
   spinningP.forEach(w=>w.rotation.x=spin);
   toolP.position.y=toolStroke;
  }
 }
 let toolStroke=0;
 function progress(p,records=[]){current=p;lastRecords=records;const f=Math.min(route.length-1,p*(route.length-1)),idx=Math.floor(f),next=Math.min(idx+1,route.length-1);robot.position.lerpVectors(route[idx],route[next],f-idx);robot.position.y=.02;const direction=route[next].clone().sub(route[idx]);if(direction.length()>.001)robot.rotation.y=Math.atan2(-direction.x,-direction.z);pose();markMeshes.forEach(m=>m.visible=false);for(const record of records){const ring=markMeshes[record.id];if(ring){ring.material=markMaterials[record.method];ring.visible=true;}}}
 let desired=null,followRobot=false;
 function view(mode){halo.visible=false;followRobot=mode==='robot';routeGroup.visible=mode!=='home'&&mode!=='robot';controls.target.set(0,.2,0);controls.minDistance=mode==='robot'?3:9;desired=mode==='plan'?new T.Vector3(0,19,.1):mode==='home'?new T.Vector3(15,13,17):mode==='robot'?robot.position.clone().add(new T.Vector3(4.4,3.2,5.2)):new T.Vector3(12,12,14);if(mode==='robot')controls.target.copy(robot.position).add(new T.Vector3(0,.6,0));if(mode==='home'){robot.position.set(1,.02,1);robot.rotation.y=-.5;markMeshes.forEach(m=>m.visible=false);lastRecords=[];current=0;pose();}}
 const ray=new T.Raycaster(),mouse=new T.Vector2();let down;
 renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const rect=renderer.domElement.getBoundingClientRect();mouse.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(mouse,camera);const hits=ray.intersectObjects(targets,true);if(hits.length){let o=hits[0].object;while(o.parent&&o.userData.target===undefined)o=o.parent;selected=o.userData.target;halo.position.set(o.position.x,.15,o.position.z);halo.visible=true;select(selected);}});
 controls.addEventListener('start',()=>{desired=null;followRobot=false;});
 const observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();});observer.observe(container);
 let running=false;const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 function animate(){
  requestAnimationFrame(animate);
  if(desired){camera.position.lerp(desired,reduced?1:.075);if(camera.position.distanceTo(desired)<.03)desired=null;}
  const event=lastRecords.at(-1),age=event?.at===undefined?Infinity:(current-event.at)*75;
  const active=age>=0&&age<1.4;
  toolStroke=active&&event.method==='机械'&&!reduced?-Math.sin(age/1.4*Math.PI)*.08:0;
  mist.visible=active&&event.method==='喷施';
  mist.children.forEach((drop,i)=>{const phase=((active?age:0)*.8+i/32)%1;drop.position.set(Math.sin(i*7)*phase*.12,-phase*.24,Math.cos(i*9)*phase*.12);});
  scan.visible=running;
  if(glb)pose();
  if(followRobot){followTarget.set(robot.position.x,robot.position.y+.6,robot.position.z);controls.target.lerp(followTarget,.12);desired=followDesired.set(robot.position.x+4.4,robot.position.y+3.2,robot.position.z+5.2);}
  controls.update();renderer.render(scene,camera);
  if(cameraHost?.isConnected){
   const w=cameraHost.clientWidth,h=cameraHost.clientHeight;
   if(onboardRenderer.domElement.clientWidth!==w||onboardRenderer.domElement.clientHeight!==h){onboardRenderer.setSize(w,h);onboardCamera.aspect=w/h;onboardCamera.updateProjectionMatrix();}
   robot.updateMatrixWorld(true);
   if(glb&&glbNodes.lens){onboardCamera.position.copy(glbNodes.lens.getWorldPosition(lensPos));onboardCamera.position.addScaledVector(robotForward.set(0,0,-1).applyQuaternion(robot.quaternion),.24);}
   else onboardCamera.position.copy(robot.localToWorld(new T.Vector3(0,1.24,-1.09)));
   onboardCamera.lookAt(robot.localToWorld(new T.Vector3(0,0,-3.2)));
   const visibility=[routeGroup.visible,marks.visible,halo.visible,scan.visible];routeGroup.visible=marks.visible=halo.visible=scan.visible=false;
   onboardRenderer.render(scene,onboardCamera);
   [routeGroup.visible,marks.visible,halo.visible,scan.visible]=visibility;
   cameraHost.dataset.action=active?event.method:'巡视';
  }
 }
 requestAnimationFrame(animate);
 return {view,setRoute,progress,mountCamera,setRunning:v=>running=v,reset:()=>view('home'),targets:targets.map((t,id)=>({id,x:t.position.x,z:t.position.z})),debug:()=>{const names=[];if(glb)glb.traverse(o=>names.push(o.name));const ndc=robot.position.clone().project(camera);return {glb:!!glb,names,cam:camera.position.toArray().map(v=>+v.toFixed(2)),tgt:controls.target.toArray().map(v=>+v.toFixed(2)),robot:robot.position.toArray().map(v=>+v.toFixed(2)),robotNdc:[+ndc.x.toFixed(2),+ndc.y.toFixed(2)],dist:+camera.position.distanceTo(controls.target).toFixed(2)};}};
}
