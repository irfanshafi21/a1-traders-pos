// Rasterize the same outlined SVG used by the app for portable PDF embedding.
let logoPromise;
export function pdfLogo(){
 if(!logoPromise)logoPromise=new Promise((resolve,reject)=>{
  const img=new Image();
  img.onload=()=>{try{const canvas=document.createElement('canvas');canvas.width=1368;canvas.height=384;canvas.getContext('2d').drawImage(img,0,0,canvas.width,canvas.height);resolve(canvas.toDataURL('image/png'))}catch(error){logoPromise=null;reject(error)}};
  img.onerror=()=>{logoPromise=null;reject(Error('The invoice logo could not load. Please reload and try again.'))};
  img.src=new URL('../assets/logo.svg',import.meta.url).href;
 });
 return logoPromise;
}
