import {outstanding} from './commerce.js';
import {pdfLogo} from './brand.js';
import {money,esc} from './core.js';

const amount=n=>Number(n/100).toLocaleString('en-IN',{minimumFractionDigits:2,maximumFractionDigits:2});
const ink=[32,37,54],muted=[110,117,135],purple=[20,57,67],line=[228,231,240];
// Locally bundled Latin font keeps invoice rendering consistent offline.
let fontData;
async function loadFont(){if(!fontData){const response=await fetch('./assets/invoice-font.ttf');if(!response.ok)throw Error('The invoice font could not load. Reload once while online.');const bytes=new Uint8Array(await response.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));fontData=btoa(binary)}return fontData}
function text(doc,value,x,y,size=10,color=ink,options={}){doc.setFontSize(size);doc.setTextColor(...color);doc.text(Array.isArray(value)?value:String(value??''),x,y,options)}
function safeName(id){return String(id).replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,80)}

export async function buildPDF(record,{kind='sale',paper='A4',sourceImage=null}={}){
 if(!window.PDFEngine)throw Error('PDF tools are still loading. Please try again.');
 const {jsPDF,autoTable}=PDFEngine;
 const doc=new jsPDF({unit:'mm',format:paper==='A5'?'a5':'a4',compress:true});
 const [font,logo]=await Promise.all([loadFont(),pdfLogo()]);doc.addFileToVFS('Invoice.ttf',font);doc.addFont('Invoice.ttf','Invoice','normal');doc.setFont('Invoice');
 const w=doc.internal.pageSize.getWidth(),h=doc.internal.pageSize.getHeight(),m=paper==='A5'?12:18,right=w-m,content=w-2*m;
 const purchase=kind==='purchase',draft=record.status==='draft',cancelled=record.status==='cancelled';
 const title=purchase?'PURCHASE REVIEW':draft?'DRAFT INVOICE':'SALES INVOICE';
 const status=purchase?(record.demo?'DEMO DATA':'REVIEWED RATES'):cancelled?'CANCELLED':draft?'NOT PAID':outstanding(record)>0?'BALANCE DUE':record.paymentVerification==='failed'?'PAYMENT FAILED':record.paymentVerification==='pending'?'PAYMENT PENDING':record.paymentVerification==='unverified'?'PAYMENT RECORDED':'PAID';
 const titleSize=paper==='A5'?12:19;
 function continuation(){doc.setDrawColor(...line);doc.line(m,20,right,20);doc.addImage(logo,'PNG',m,6,32,32*64/228); text(doc,record.id,right,14,8,muted,{align:'right'})}
 doc.setFillColor(...purple);doc.rect(0,0,w,3,'F');
 doc.addImage(logo,'PNG',m,10,42,42*64/228);
 doc.setFontSize(11);const storeLines=doc.splitTextToSize(record.store||'A1 TRADERS',content*.46);text(doc,storeLines,m,29,11);
 doc.setFontSize(8.5);const address=doc.splitTextToSize([record.address,record.taxId?'Tax ID: '+record.taxId:'',record.phone,record.email].filter(Boolean).join(' · '),content*.46);text(doc,address,m,35+(storeLines.length-1)*6,8.5,muted);
 text(doc,title,right,18,titleSize,purple,{align:'right'});
 text(doc,status,right,26,9,purchase?muted:cancelled?[190,54,74]:draft?muted:[32,126,100],{align:'right'});
 let y=Math.max(51,42+(storeLines.length-1)*6+address.length*4);
 doc.setDrawColor(...line);doc.line(m,y-5,right,y-5);
 text(doc,purchase?'PREPARED FOR':'BILL TO',m,y+2,8,muted);
 const customer=doc.splitTextToSize(purchase?record.store:((record.customer||'Walk-in customer')+(record.customerTaxId?' / Tax ID: '+record.customerTaxId:'')),content*.5);
 text(doc,customer,m,y+9,11);
 text(doc,purchase?'Review number':'Invoice number',right-52,y+2,8,muted);
 text(doc,record.id,right,y+9,9,ink,{align:'right'});
 text(doc,new Date(record.created).toLocaleString('en-IN',{year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'}),right,y+16,8,muted,{align:'right'});
 y+=Math.max(28,customer.length*5+21);
 const rows=purchase?record.lines.map((l,i)=>[i+1,l.name,`${l.qty} ${l.unit}`,amount(l.cost),amount(l.price),amount(Math.round(l.price*l.qty))]):record.lines.map((l,i)=>[i+1,l.name+(l.discount?`\n${l.discount}% line discount`:''),`${l.qty} ${l.unit}`,amount(l.price),`${l.tax}%`,amount(l.total)]);
 autoTable(doc,{startY:y,margin:{left:m,right:m,top:27,bottom:20},head:[purchase?['#','Item description','Quantity','Supplier rate','Your rate','Sale value']:['#','Item description','Quantity','Rate','Tax','Amount']],body:rows,theme:'plain',styles:{font:'Invoice',fontSize:paper==='A5'?8:9,cellPadding:3, valign:'middle',textColor:ink,lineWidth:0,lineColor:line,overflow:'linebreak'},headStyles:{fillColor:purple,textColor:[255,255,255],fontStyle:'normal',fontSize:paper==='A5'?7:8},alternateRowStyles:{fillColor:[248,249,253]},columnStyles:{0:{cellWidth:10,cellPadding:2,textColor:muted},1:{cellWidth:content*(paper==='A5'?.29:.36)},2:{halign:'right'},3:{halign:'right'},4:{halign:'right'},5:{halign:'right'}},rowPageBreak:'avoid',didDrawPage:()=>{if(doc.internal.getCurrentPageInfo().pageNumber>1)continuation()}});
 y=doc.lastAutoTable.finalY+10;
 const payments=purchase?[]:[...(record.payments||[]).filter(p=>p.method!=='Credit'),...(record.collections||[])];
 const taxRows=purchase?[]:Object.entries(record.rates||{}).filter(([,v])=>v>0);
 const summaryRows=purchase?[['Supplier total',record.purchaseTotal],['Your selling total',record.total],['Estimated gross margin',record.total-record.purchaseTotal]]:[['Subtotal',record.subtotal],['Discounts',-(record.lineDiscount+record.invoiceDiscount)],...taxRows.map(([rate,value])=>[`GST / VAT ${rate}%`,value])];
 const summaryHeight=summaryRows.length*7+23+payments.length*5+18;
 if(y+summaryHeight>h-20){doc.addPage();continuation();y=31}
 const sx=paper==='A5'?m:right-85;
 for(const [label,value]of summaryRows){text(doc,label,sx,y,9,muted);text(doc,amount(value),right,y,10,ink,{align:'right'});y+=7}
 doc.setFillColor(240,237,255);doc.roundedRect(sx-3,y-1,right-sx+6,16,2,2,'F');
 text(doc,purchase?'YOUR SALE VALUE':'TOTAL (INR)',sx,y+9,10,purple);text(doc,amount(record.total),right,y+9,15,purple,{align:'right'});y+=24;
 for(const p of payments){text(doc,`${p.method} received`,sx,y,8,muted);text(doc,amount(p.amount),right,y,9,ink,{align:'right'});y+=5}
 if(!purchase&&outstanding(record)>0){text(doc,'Balance due (INR): '+amount(outstanding(record)),m,y+3,10,purple);y+=9}if(!purchase&&record.returns?.length){text(doc,'Returns recorded: '+amount(record.returns.reduce((n,r)=>n+r.amount,0))+' INR',m,y+3,9,muted);y+=9}
 const exchangeNote=record.exchangeFor?'Replacement for invoice '+record.exchangeFor+'. ':'';
 const note=exchangeNote+(purchase?'Supplier rates are recorded separately from your selling rates. This is a purchase review, not proof of payment.':cancelled?'This invoice has been cancelled. Any payment refund is handled separately.':draft?'Draft invoice only. No payment has been recorded and inventory has not been deducted.':'Thank you for shopping with us. Please keep this invoice for your records.');
 doc.setFontSize(8);const noteLines=doc.splitTextToSize(note,content);
 if(y+noteLines.length*4+10>h-18){doc.addPage();continuation();y=30}
 text(doc,noteLines,m,y+10,8,muted);
 if(sourceImage?.dataURL&&sourceImage.type!=='application/pdf'){
  doc.addPage();continuation();text(doc,'ORIGINAL SUPPLIER BILL',m,32,12,purple);
  const props=doc.getImageProperties(sourceImage.dataURL),ratio=Math.min(content/props.width,(h-62)/props.height),iw=props.width*ratio,ih=props.height*ratio;
  doc.addImage(sourceImage.dataURL,props.fileType,m+(content-iw)/2,40,iw,ih);
 }
 const pages=doc.getNumberOfPages();
 for(let n=1;n<=pages;n++){doc.setPage(n);doc.setDrawColor(...line);doc.line(m,h-15,right,h-15);text(doc,'A1 TRADERS  |  All amounts in INR',m,h-9,7,muted);text(doc,`${n} / ${pages}`,right,h-9,7,muted,{align:'right'})}
 doc.setProperties({title:`${title} - ${record.id}`,subject:purchase?'Reviewed supplier and selling rates':'Customer invoice',author:record.store,creator:'A1 TRADERS'});
 const blob=doc.output('blob'),filename=`${purchase?'Purchase-review':draft?'Draft-invoice':'Invoice'}-${safeName(record.id)}.pdf`;
 return {blob,filename,url:URL.createObjectURL(blob),record,kind,paper};
}

export function savePDF(pdf){const a=document.createElement('a');a.href=pdf.url;a.download=pdf.filename;a.click()}
export function pdfFile(pdf){return new File([pdf.blob],pdf.filename,{type:'application/pdf'})}
export function canSharePDF(pdf){const file=pdfFile(pdf);return !!(navigator.share&&navigator.canShare?.({files:[file]}))}
export function sharePDF(pdf){return navigator.share({files:[pdfFile(pdf)],title:pdf.filename})}

export function invoicePreview(s,kind='sale'){
 const purchase=kind==='purchase';
 return `<article class="invoice-sheet"><header><div><img class="invoice-logo" src="assets/logo.svg" alt="A1 TRADERS"><span class="invoice-brand">${esc(s.store)}</span><p>${esc(s.address)}${s.taxId?`<br>Tax ID: ${esc(s.taxId)}`:''}</p></div><div class="invoice-heading"><strong>${purchase?'PURCHASE REVIEW':'INVOICE'}</strong><span class="invoice-status ${s.status==='draft'?'draft':''}">${purchase?(s.demo?'DEMO DATA':'REVIEWED'):s.status==='draft'?'DRAFT · NOT PAID':s.status==='cancelled'?'CANCELLED':outstanding(s)>0?'BALANCE DUE':s.paymentVerification==='failed'?'PAYMENT FAILED':s.paymentVerification==='pending'?'PAYMENT PENDING':s.paymentVerification==='unverified'?'PAYMENT RECORDED':'PAID'}</span></div></header><div class="invoice-meta"><div><small>${purchase?'PREPARED FOR':'BILL TO'}</small><strong>${esc(purchase?s.store:s.customer||'Walk-in customer')}</strong></div><div><small>${esc(s.id)}</small><span>${esc(new Date(s.created).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}))}</span></div></div><table class="invoice-table"><thead><tr><th>Item</th><th>Qty</th>${purchase?'<th>Supplier</th>':''}<th>${purchase?'Your rate':'Rate'}</th><th>Amount</th></tr></thead><tbody>${s.lines.map(l=>`<tr><td>${esc(l.name)}${!purchase?`<small>Tax ${l.tax}%${l.discount?` · Discount ${l.discount}%`:''}</small>`:''}</td><td>${l.qty} <small>${esc(l.unit)}</small></td>${purchase?`<td>${money(l.cost)}</td>`:''}<td>${money(l.price)}</td><td>${money(purchase?Math.round(l.price*l.qty):l.total)}</td></tr>`).join('')}</tbody></table><div class="invoice-summary">${purchase?`<div><span>Supplier total</span><span>${money(s.purchaseTotal)}</span></div>`:`<div><span>Subtotal</span><span>${money(s.subtotal)}</span></div><div><span>Discounts</span><span>−${money(s.lineDiscount+s.invoiceDiscount)}</span></div><div><span>Tax</span><span>${money(s.tax)}</span></div>`}<div class="invoice-grand"><strong>${purchase?'Your sale value':'Total amount'}</strong><strong>${money(s.total)}</strong></div></div><p class="help mt-4">${!purchase&&outstanding(s)>0?'Outstanding: '+money(outstanding(s)):''}${s.returns?.length?' · Returns recorded: '+money(s.returns.reduce((n,r)=>n+r.amount,0)):''}</p><footer>${purchase?'Your rates and quantities, ready for inventory or billing.':s.status==='draft'?'Draft invoice · payment not yet recorded':'Thank you for shopping with us.'}</footer></article>`;
}
