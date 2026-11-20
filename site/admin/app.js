"use strict";
const API="https://oppaviqjlyrnkpxjsfvo.supabase.co/functions/v1/invoice-api";
const $=id=>document.getElementById(id);
let auth=sessionStorage.getItem("nicole_invoice_auth")||"",offset=0,rows=[],total=0,busy=false;
function err(id,message){$(id).textContent=message||"";$(id).classList.toggle("hidden",!message);}
async function call(action,body={}){const res=await fetch(API,{method:"POST",headers:{"content-type":"application/json",...(auth?{"x-almacen-key":auth}:{})},body:JSON.stringify({action,...body})});const data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||"Error del servidor");return data;}
function show(){ $("login").classList.add("hidden");$("panel").classList.remove("hidden");load();}
function exit(){auth="";sessionStorage.removeItem("nicole_invoice_auth");$("login").classList.remove("hidden");$("panel").classList.add("hidden");$("pin").value="";}
$("loginForm").onsubmit=async e=>{e.preventDefault();err("loginError","");$("loginButton").disabled=true;try{const result=await call("adminLogin",{pin:$("pin").value});auth=result.token;sessionStorage.setItem("nicole_invoice_auth",auth);show();}catch(ex){err("loginError",ex.message);}finally{$("loginButton").disabled=false;}};
async function load(){if(busy)return;busy=true;err("panelError","");try{const result=await call("adminList",{offset,limit:100,status:$("filter").value});rows=result.rows;total=result.total;$("total").textContent=total;$("pending").textContent=rows.filter(x=>x.status==="pendiente").length;$("managed").textContent=rows.filter(x=>x.status==="gestionado").length;$("pagination").textContent=total?(offset+1)+"–"+(offset+rows.length)+" de "+total:"Sin registros";$("prev").disabled=offset===0;$("next").disabled=offset+rows.length>=total;render();}catch(ex){if(ex.message.includes("Sesión no autorizada")){exit();err("loginError","Tu sesión terminó. Ingresa nuevamente.");}else err("panelError",ex.message);}finally{busy=false;}}
function td(row,title,subtitle){const cell=document.createElement("td"),b=document.createElement("strong");b.textContent=title||"";cell.appendChild(b);if(subtitle){const s=document.createElement("small");s.textContent=subtitle;cell.appendChild(s);}row.appendChild(cell);return cell;}
function render(){const body=$("records");body.replaceChildren();const term=$("search").value.toLowerCase();const shown=rows.filter(r=>[r.full_name,r.email,r.id_number,r.phone].some(v=>String(v||"").toLowerCase().includes(term)));if(!shown.length){const tr=document.createElement("tr"),cell=document.createElement("td");cell.colSpan=6;cell.textContent="No se encontraron registros.";tr.append(cell);body.append(tr);return;}
for(const r of shown){const tr=document.createElement("tr");
td(tr,new Date(r.created_at).toLocaleString("es-EC",{dateStyle:"short",timeStyle:"short",timeZone:"America/Guayaquil"}));
td(tr,r.full_name,r.address||"Sin dirección");
td(tr,r.id_number,r.id_type==="cedula"?"Cédula":r.id_type==="ruc"?"RUC":"Pasaporte");
const contact=td(tr,r.email,r.phone);const a=document.createElement("a");a.href="mailto:"+r.email;a.textContent="Preparar correo";a.style.display="block";contact.append(a);
const state=document.createElement("td"),pill=document.createElement("span");pill.className="pill"+(r.status==="gestionado"?" done":"");pill.textContent=r.status==="gestionado"?"Gestionado":"Pendiente";state.append(pill);if(r.invoice_reference){const s=document.createElement("small");s.textContent="Factura: "+r.invoice_reference;state.append(s);}tr.append(state);
const controls=document.createElement("td");
if(r.has_receipt){
 const showPhoto=document.createElement("button");showPhoto.className="small secondary";
 showPhoto.textContent="Ver foto de la compra";showPhoto.style.marginBottom="6px";
 showPhoto.onclick=async()=>{
   showPhoto.disabled=true;
   try{
     const response=await call("adminReceipt",{id:r.id});
     $("receiptImage").src=response.url;
     $("receiptLink").href=response.url;
     $("receiptDialog").showModal();
   }catch(ex){err("panelError",ex.message);}
   finally{showPhoto.disabled=false;}
 };
 controls.append(showPhoto,document.createElement("br"));
}
const button=document.createElement("button");button.className="small"+(r.status==="gestionado"?" secondary":"");button.textContent=r.status==="gestionado"?"Reabrir":"Marcar gestionado";
button.onclick=async()=>{const done=r.status!=="gestionado";let ref="";if(done){const entered=prompt("Referencia de factura (opcional). Marca gestionado después de emitirla:",r.invoice_reference||"");if(entered===null)return;ref=entered;}else if(!confirm("¿Devolver a pendiente?"))return;button.disabled=true;try{await call("adminMark",{id:r.id,completed:done,invoice_reference:ref});await load();}catch(ex){err("panelError",ex.message);}finally{button.disabled=false;}};controls.append(button);
const copy=document.createElement("button");copy.className="small secondary";copy.style.marginTop="5px";copy.textContent="Copiar datos";copy.onclick=async()=>{const data=[r.full_name,r.id_type+": "+r.id_number,"Correo: "+r.email,"Celular: "+r.phone,"Dirección: "+(r.address||"No indicada")].join("\n");try{await navigator.clipboard.writeText(data);copy.textContent="Copiado";}catch(_){prompt("Copia los datos",data);}};controls.append(document.createElement("br"),copy);tr.append(controls);body.append(tr);
}}
$("closeReceipt").onclick=()=>$("receiptDialog").close();
$("receiptDialog").addEventListener("close",()=>{$("receiptImage").removeAttribute("src");$("receiptLink").removeAttribute("href");});
$("refresh").onclick=load;$("search").oninput=render;$("filter").onchange=()=>{offset=0;load();};$("prev").onclick=()=>{offset=Math.max(0,offset-100);load();};$("next").onclick=()=>{if(offset+100<total){offset+=100;load();}};
$("logout").onclick=async()=>{try{await call("adminLogout");}catch(_){}exit();};
$("copyLink").onclick=()=>{navigator.clipboard.writeText("https://jeffer91.github.io/facturas-nicole/").then(()=>{$("copyLink").textContent="Copiado";},()=>prompt("Copia este enlace","https://jeffer91.github.io/facturas-nicole/"));};
function escapeCsv(v){let s=String(v??"");if(/^[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
$("csv").onclick=async()=>{$("csv").disabled=true;try{let all=[],i=0,n=1;while(i<n&&i<50000){const res=await call("adminList",{offset:i,limit:200,status:$("filter").value});all.push(...res.rows);i+=res.rows.length;n=res.total;if(!res.rows.length)break;}
const keys=["created_at","id_type","id_number","full_name","email","phone","address","has_receipt","status","invoice_reference","managed_at"];
const content="\ufeff"+[keys.join(";"),...all.map(r=>keys.map(k=>escapeCsv(r[k])).join(";"))].join("\r\n"),url=URL.createObjectURL(new Blob([content],{type:"text/csv;charset=utf-8"}));const a=document.createElement("a");a.href=url;a.download="clientes-nicole-"+new Date().toISOString().slice(0,10)+".csv";a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(ex){err("panelError",ex.message);}finally{$("csv").disabled=false;}};
if(auth)show();