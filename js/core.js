/* All prices stored as integer paise. Quantities may have three decimals. */
export const db = new Dexie('SpeedBillUltraV1');
db.version(1).stores({products:'id,sku,barcode,name,category',sales:'id,created,status',parked:'id,created',audit:'++id,time',settings:'key',drafts:'id'});
// Track stock deltas inside the transaction; keep audit rows proportional to changed items.
function stockDelta(tx,p,before,after){if(before===after)return;(tx.speedbillStockChanges??=[]).push({id:p.id,name:p.name,unit:p.unit,before,after,change:Math.round((after-before)*1000)/1000})}
db.products.hook('creating',function(key,p,tx){stockDelta(tx,p,0,p.stock)});
db.products.hook('updating',function(mods,key,p,tx){if(Object.hasOwn(mods,'stock'))stockDelta(tx,p,p.stock,mods.stock)});
db.products.hook('deleting',function(key,p,tx){stockDelta(tx,p,p.stock,0)});
export const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format((n||0)/100);
export const uid = () => crypto.randomUUID();
export const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const round = n => Math.round((Number(n)+Number.EPSILON)*100)/100;
export const dateOffset = days => {const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)};
export function totals(cart,discount=0){
 const lines=cart.map(l=>{const gross=Math.round(l.price*l.qty);const net=gross-Math.round(gross*l.discount/100);return {...l,gross,net}});
 const subtotal=lines.reduce((a,l)=>a+l.gross,0),lineDiscount=lines.reduce((a,l)=>a+l.gross-l.net,0),base=subtotal-lineDiscount;
 const invoiceDiscount=Math.round(base*Math.min(100,Math.max(0,discount))/100);
 // Largest-remainder allocation keeps every line nonnegative and totals exact.
 const portions=lines.map((l,i)=>{const exact=base?invoiceDiscount*l.net/base:0;return {i,share:Math.floor(exact),fraction:exact-Math.floor(exact)}});
 let remainder=invoiceDiscount-portions.reduce((a,p)=>a+p.share,0);
 [...portions].sort((a,b)=>b.fraction-a.fraction||a.i-b.i).forEach(p=>{if(remainder>0){p.share++;remainder--}});
 const rates={};
 lines.forEach((l,i)=>{l.taxable=l.net-portions[i].share;l.taxAmount=Math.round(l.taxable*l.tax/100);l.total=l.taxable+l.taxAmount;rates[l.tax]=(rates[l.tax]||0)+l.taxAmount});
 const tax=lines.reduce((a,l)=>a+l.taxAmount,0);return {lines,subtotal,lineDiscount,invoiceDiscount,tax,rates,total:base-invoiceDiscount+tax};
}
export function validateProduct(p){
 if(!String(p.name||'').trim())throw Error('Every item needs a product name.');
 for(const k of ['price','cost','stock','tax'])if(!Number.isFinite(+p[k])||+p[k]<0)throw Error(`${p.name}: ${k} must be a positive number or zero.`);
 if(p.tax>100)throw Error('Tax must be between 0 and 100%.');
 if(!['pcs','kg','g','l'].includes(p.unit))throw Error('Unit must be pcs, kg, g or l.');
 if(p.unit==='pcs'&&!Number.isInteger(+p.stock))throw Error(`${p.name}: piece quantities must be whole numbers.`);
 if(p.serial && p.stock>1)throw Error('A serialized inventory record may contain at most one unit.');
 for(const k of ['mfg'])if(p[k]&&(!/^\d{4}-\d{2}-\d{2}$/.test(p[k])||Number.isNaN(Date.parse(p[k]))||new Date(p[k]).toISOString().slice(0,10)!==p[k]))throw Error('Use a valid YYYY-MM-DD date.');
 return p;
}
export async function audit(event,details,actor='Alex Morgan'){
 // Called inside the same Dexie transaction as each critical mutation.
 const last=await db.audit.orderBy('id').last();
 const row={time:new Date().toISOString(),actor,event,details,previous:last?.hash||'GENESIS'};
 if(['Store initialized','Stock history enabled'].includes(event))row.stockSnapshot=(await db.products.toArray()).map(p=>({id:p.id,name:p.name,stock:p.stock,unit:p.unit}));
 const tx=Dexie.currentTransaction;if(tx?.speedbillStockChanges?.length){row.stockChanges=tx.speedbillStockChanges.splice(0)}
 row.hash=await Dexie.waitFor(crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(row))).then(b=>Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,'0')).join('')));
 await db.audit.add(row);
}
export async function verifyAudit(){let previous='GENESIS';for(const {id,hash,...row} of await db.audit.toArray()){if(row.previous!==previous)return false;const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(row)))),n=>n.toString(16).padStart(2,'0')).join('');if(digest!==hash)return false;previous=hash}return true}
const groceries=[
 ['Farm Fresh Milk','Dairy & Eggs',64,49,48,0,0,'1 litre','pcs',7],
 ['Whole Wheat Bread','Bakery',55,39,24,0,1,'400 g','pcs',3],
 ['Free Range Eggs','Dairy & Eggs',90,70,36,0,2,'6 pack','pcs',14],
 ['Royal Gala Apples','Fruits & Veg',180,125,32,0,3,'Per kg','kg',12],
 ['Fresh Bananas','Fruits & Veg',60,36,26,0,4,'Per kg','kg',5],
 ['Premium Basmati Rice','Pantry',210,162,65,5,5,'1 kg','pcs',240],
 ['Classic Roast Coffee','Beverages',349,250,18,5,6,'200 g','pcs',180],
 ['Extra Virgin Olive Oil','Pantry',599,410,14,5,7,'500 ml','pcs',300],
 ['Dark Chocolate','Snacks',120,82,42,18,8,'100 g','pcs',120],
 ['Fresh Orange Juice','Beverages',110,75,22,12,9,'1 litre','pcs',45],
 ['Salted Butter','Dairy & Eggs',58,42,30,12,10,'100 g','pcs',60],
 ['Greek Yogurt','Dairy & Eggs',65,43,8,5,11,'150 g','pcs',-2]
];
const other={Electronics:[['Wireless Headphones','Electronics',2499,1800,12,18,-1,'Bluetooth','pcs'],['USB-C Fast Charger','Electronics',799,440,35,18,-1,'30 W','pcs'],['Portable Power Bank','Electronics',1499,950,14,18,-1,'10,000 mAh','pcs']],Apparel:[['Essential Cotton Tee','Apparel',599,280,32,5,-1,'Medium · Navy','pcs'],['Classic Denim Jeans','Apparel',1899,1000,16,12,-1,'32 · Indigo','pcs'],['Crew Socks','Apparel',199,90,55,5,-1,'3 pairs','pcs']],Pharmacy:[['Vitamin C Tablets','Pharmacy',149,85,40,12,-1,'20 tablets','pcs',22],['Antiseptic Solution','Pharmacy',95,52,25,12,-1,'100 ml','pcs',270],['First Aid Kit','Pharmacy',399,225,10,12,-1,'Travel kit','pcs',365]]};

const extraCatalog={"Grocery": [["Rolled Oats", "Pantry", 149, 105, 35, "500 g", "pcs"], ["Toor Dal", "Pantry", 165, 125, 48, "1 kg", "pcs"], ["Chickpeas", "Pantry", 120, 85, 40, "500 g", "pcs"], ["Whole Wheat Flour", "Pantry", 260, 205, 30, "5 kg", "pcs"], ["Brown Sugar", "Pantry", 85, 60, 42, "500 g", "pcs"], ["Sea Salt", "Pantry", 35, 22, 60, "1 kg", "pcs"], ["Sunflower Oil", "Pantry", 155, 120, 36, "1 litre", "pcs"], ["Penne Pasta", "Pantry", 99, 68, 28, "500 g", "pcs"], ["Tomato Ketchup", "Pantry", 125, 90, 32, "500 g", "pcs"], ["Peanut Butter", "Pantry", 249, 175, 24, "400 g", "pcs"], ["Green Tea", "Beverages", 199, 140, 22, "25 bags", "pcs"], ["Mineral Water", "Beverages", 20, 12, 96, "1 litre", "pcs"], ["Coconut Water", "Beverages", 45, 30, 48, "200 ml", "pcs"], ["Potato Chips", "Snacks", 30, 21, 72, "60 g", "pcs"], ["Roasted Almonds", "Snacks", 299, 220, 20, "200 g", "pcs"], ["Oat Cookies", "Snacks", 80, 55, 38, "150 g", "pcs"], ["Fresh Tomatoes", "Fruits & Veg", 40, 25, 25, "Per kg", "kg"], ["Red Onions", "Fruits & Veg", 45, 30, 45, "Per kg", "kg"], ["Potatoes", "Fruits & Veg", 35, 22, 50, "Per kg", "kg"], ["Carrots", "Fruits & Veg", 65, 42, 20, "Per kg", "kg"], ["Paneer", "Dairy & Eggs", 95, 72, 25, "200 g", "pcs"], ["Cheddar Cheese", "Dairy & Eggs", 145, 110, 18, "200 g", "pcs"], ["Croissant", "Bakery", 65, 40, 20, "1 piece", "pcs"], ["Sandwich Buns", "Bakery", 45, 30, 28, "4 pack", "pcs"]], "Electronics": [["Wireless Mouse", "Electronics", 699, 420, 20, "Bluetooth", "pcs"], ["Mechanical Keyboard", "Electronics", 2499, 1750, 12, "Compact", "pcs"], ["USB-C Cable", "Electronics", 299, 140, 55, "1 metre", "pcs"], ["Phone Stand", "Electronics", 249, 110, 30, "Adjustable", "pcs"], ["Portable Speaker", "Electronics", 1799, 1200, 15, "Wireless", "pcs"], ["LED Desk Lamp", "Electronics", 999, 650, 18, "USB powered", "pcs"]], "Apparel": [["Linen Shirt", "Apparel", 1299, 720, 18, "Large \u00b7 White", "pcs"], ["Everyday Hoodie", "Apparel", 1599, 890, 15, "Medium \u00b7 Grey", "pcs"], ["Cotton Cap", "Apparel", 349, 160, 24, "Adjustable \u00b7 Black", "pcs"], ["Canvas Tote Bag", "Apparel", 299, 130, 30, "Natural cotton", "pcs"], ["Sports Shorts", "Apparel", 699, 350, 22, "Medium \u00b7 Navy", "pcs"], ["Cotton Scarf", "Apparel", 449, 210, 16, "Blue", "pcs"]], "Pharmacy": [["Digital Thermometer", "Pharmacy", 249, 150, 20, "1 unit", "pcs"], ["Cotton Roll", "Pharmacy", 65, 38, 40, "100 g", "pcs"], ["Adhesive Bandages", "Pharmacy", 55, 30, 45, "20 strips", "pcs"], ["Hand Sanitizer", "Pharmacy", 99, 60, 32, "100 ml", "pcs"], ["Surgical Masks", "Pharmacy", 120, 70, 35, "10 pack", "pcs"], ["Hot Water Bag", "Pharmacy", 199, 115, 18, "2 litre", "pcs"]]};
for(const [industry,rows] of Object.entries(extraCatalog)){const target=industry==='Grocery'?groceries:other[industry];for(const [name,category,price,cost,stock,size,unit] of rows)target.push([name,category,price,cost,stock,0,-1,size,unit]);}
export function catalog(industry='Grocery'){return (industry==='Grocery'?groceries:other[industry]||[]).map((r,i)=>({id:uid(),name:r[0],category:r[1],price:r[2]*100,cost:r[3]*100,stock:r[4],tax:r[5],art:r[6],size:r[7],unit:r[8],mfg:dateOffset(-30),batch:`${industry.slice(0,3).toUpperCase()}-2609-${String(i+1).padStart(2,'0')}`,serial:'',sku:`${industry.slice(0,3).toUpperCase()}-${String(i+1).padStart(4,'0')}`,barcode:`890${industry==='Grocery'?'100':industry==='Electronics'?'200':industry==='Apparel'?'300':'400'}${String(i+1).padStart(7,'0')}`}))}
export async function init(){await db.open();if(!await db.settings.get('initialized')){await db.transaction('rw',db.products,db.settings,db.audit,async()=>{await db.products.bulkAdd(catalog());await db.settings.put({key:'initialized',value:true});await audit('Store initialized','Grocery demonstration catalog')})}if(!await db.settings.get('expanded-demo-v14'))await db.transaction('rw',db.products,db.settings,db.audit,async()=>{const existing=new Set((await db.products.toArray()).map(p=>p.sku));let added=0;for(const industry of ['Grocery','Electronics','Apparel','Pharmacy'])for(const p of catalog(industry)){if(!existing.has(p.sku)){await db.products.add(p);existing.add(p.sku);added++}}await db.settings.put({key:'expanded-demo-v14',value:true});await audit('Demo catalog expanded',`${added} sample products added; existing SKUs preserved. Sample tax rates require review.`)});if(!await db.audit.filter(r=>!!r.stockSnapshot).first())await db.transaction('rw',db.products,db.audit,async()=>audit('Stock history enabled','Opening inventory snapshot'));return db.products.toArray()}
export async function commitSale(cart,discount,payments,customer,settings){
 return db.transaction('rw',db.products,db.sales,db.audit,db.drafts,db.settings,async()=>{
  if(settings.checkoutId){const existing=await db.settings.get('checkout:'+settings.checkoutId);if(existing)return db.sales.get(existing.value)}
  if(!cart.length)throw Error('Add items to start a sale.');
  if(new Set(cart.map(l=>l.id)).size!==cart.length)throw Error('Duplicate product lines detected. Combine their quantities before checkout.');
  if(cart.some(l=>!Number.isSafeInteger(l.price)||Math.abs(l.qty*1000-Math.round(l.qty*1000))>0.000001))throw Error('Use valid prices and quantities with at most three decimal places.');
  if(!Number.isFinite(discount)||discount<0||discount>100||cart.some(l=>!Number.isInteger(l.price)||l.price<0||!Number.isFinite(l.discount)||l.discount<0||l.discount>100||!Number.isFinite(l.tax)||l.tax<0||l.tax>100))throw Error('Invalid sale prices, discounts or tax rates.');
  const total=totals(cart,discount);if(!Number.isSafeInteger(total.total))throw Error('Bill amount exceeds the supported range.');if(total.total<=0)throw Error('The sale total must be greater than zero.');
  if(payments.some(p=>!['Cash','Card','UPI','Credit'].includes(p.method)))throw Error('Invalid payment method.');if(payments.some(p=>p.method==='Credit'&&p.amount>0)&&!customer.trim())throw Error('Customer name/contact is required for credit.');
  const paid=payments.reduce((a,p)=>a+p.amount,0);if(paid!==total.total||payments.some(p=>!Number.isInteger(p.amount)||p.amount<0))throw Error('Payments must match the amount due.');
  for(const l of cart){const p=await db.products.get(l.id);if(!p)throw Error(`${l.name} no longer exists.`);if(l.qty<=0||!Number.isFinite(l.qty)||p.stock<l.qty)throw Error(`Insufficient stock for ${p.name}.`);if(p.unit==='pcs'&&!Number.isInteger(l.qty))throw Error('Piece quantities must be whole numbers.');await db.products.update(l.id,{stock:Math.round((p.stock-l.qty)*1000)/1000})}
  const sequence=((await db.settings.get('invoice-sequence'))?.value||0)+1;await db.settings.put({key:'invoice-sequence',value:sequence});const prefix=settings.invoicePrefix||'SB';
  const sale={id:prefix+'-'+String(sequence).padStart(6,'0')+'-'+uid().slice(0,4).toUpperCase(),exchangeFor:settings.exchangeFor||'',taxId:settings.taxId||'',customerTaxId:settings.customerTaxId||'',phone:settings.phone||'',email:settings.email||'',created:new Date().toISOString(),status:'completed',...total,discount,payments,customer,store:settings.store||'A1 TRADERS',address:settings.address||'Your neighborhood, made better.',cashier:settings.cashier||'Alex Morgan'};
  sale.paymentVerification=payments.some(p=>['Card','UPI'].includes(p.method)&&p.amount>0)?'unverified':'cash-recorded';
  await db.sales.add(sale);if(settings.checkoutId)await db.settings.put({key:'checkout:'+settings.checkoutId,value:sale.id});await db.drafts.delete('active');await audit('Sale completed',`${sale.id} · ${money(total.total)} · ${payments.map(p=>p.method).join(' + ')}`,sale.cashier);return sale;
 })
}
export async function cancelSale(id,reason,actor){return db.transaction('rw',db.sales,db.products,db.audit,async()=>{const s=await db.sales.get(id);if(!s||s.status==='cancelled')throw Error('This bill is already cancelled.');if(s.returns?.length||s.collections?.length||s.payments.some(p=>p.method==='Credit'))throw Error('Use Returns & exchanges for credit bills or bills with returns/collections.');for(const l of s.lines){const p=await db.products.get(l.id);if(!p)throw Error('Original inventory record missing.');await db.products.update(l.id,{stock:Math.round((p.stock+l.qty)*1000)/1000})}await db.sales.update(id,{status:'cancelled',reason});await audit('Bill cancelled',`${id} · ${reason} · stock returned; payment refund must be handled separately`,actor)})}
