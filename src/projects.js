const blends=new Set(['source-over','multiply','screen','overlay']);
const png=/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;
export function validateProject(value) {
  if(!value || value.format!=='prism-project' || value.version!==1)throw new Error('This is not a supported Prism project.');
  const {width,height,layers,adjustments}=value;
  if(![width,height].every(n=>Number.isInteger(n)&&n>=1&&n<=8000))throw new Error('Invalid project dimensions.');
  if(!Array.isArray(layers)||layers.length<1||layers.length>100||width*height*layers.length>100_000_000)throw new Error('This project exceeds the layer or memory limit.');
  for(const l of layers){
    if(!l || typeof l.name!=='string'||l.name.length>200||!png.test(l.image)||l.image.length>100_000_000||!Number.isFinite(l.x)||!Number.isFinite(l.y)||Math.abs(l.x)>100000||Math.abs(l.y)>100000||!Number.isFinite(l.opacity)||l.opacity<0||l.opacity>1||!blends.has(l.blend)||typeof l.visible!=='boolean'||typeof l.locked!=='boolean')throw new Error('A project layer is invalid.');
  }
  if(!adjustments||!['brightness','contrast','saturation'].every(k=>Number.isFinite(adjustments[k])&&adjustments[k]>=0&&adjustments[k]<=200))throw new Error('Invalid project adjustments.');
  if(!Number.isInteger(value.activeIndex)||value.activeIndex<0||value.activeIndex>=layers.length)throw new Error('Invalid active layer.');
  return value;
}
export function serializeProject({canvas,layers,adjustments,activeId,name}) {
  const data={format:'prism-project',version:1,name:name||'Untitled',width:canvas.width,height:canvas.height,adjustments:{...adjustments},activeIndex:layers.findIndex(l=>l.id===activeId),layers:layers.map(l=>({name:l.name,x:l.x,y:l.y,visible:l.visible,locked:l.locked,opacity:l.opacity,blend:l.blend,image:l.canvas.toDataURL('image/png')}))};
  validateProject(data);
  return JSON.stringify(data);
}
export async function deserializeProject(text) {
  if(text.length>150_000_000)throw new Error('Project files must be smaller than 150 MB.');
  let parsed;try{parsed=JSON.parse(text);}catch{throw new Error('This project file is damaged.');}
  const data=validateProject(parsed);
  const decoded=[];
  for(const l of data.layers){
    const img=new Image();
    await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(new Error('A project image could not be decoded.'));img.src=l.image;});
    if(img.naturalWidth!==data.width||img.naturalHeight!==data.height)throw new Error('A project layer has inconsistent dimensions.');
    const canvas=document.createElement('canvas');canvas.width=data.width;canvas.height=data.height;canvas.getContext('2d').drawImage(img,0,0);
    decoded.push({...l,canvas});
  }
  return {...data,layers:decoded};
}
