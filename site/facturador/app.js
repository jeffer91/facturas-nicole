"use strict";
const API="https://oppaviqjlyrnkpxjsfvo.supabase.co/functions/v1/invoice-api";
const desktop=window.nicoleDesktop||null;
const $=id=>document.getElementById(id);
const money=n=>new Intl.NumberFormat("es-EC",{style:"currency",currency:"USD"}).format(Number(n)||0);
let auth=sessionStorage.getItem("nicole_invoice_auth")||"",clients=[],selected=null,settings=null,processing=false;
function error(id,msg){$(id).textContent=msg||"";$(id).classList.toggle("hidden",!msg);}
function setBusy(value){processing=value;$("issue").disabled=value||!desktop;$("saveSettings").disabled=value;$("refreshHistory").disabled=value;$("issue").textContent=value?"Procesando, no cierres la aplicación…":"Firmar y enviar al SRI";}
function status(message,ok=false){const node=$("operationStatus");node.textContent=message;node.className="status-note"+(ok?" success-note":"");}
async function call(action,body={}){
  if(desktop)return await desktop.api(action,body,auth);
  const res=await fetch(API,{method:"POST",headers:{"content-type":"application/json",...(auth?{"x-almacen-key":auth}:{})},body:JSON.stringify({action,...body})});
  const data=await res.json();
  if(!res.ok||!data.ok)throw Error(data.error||"Error del servidor");
  return data;
}
async function openWorkspace(){
  error("loginError","");
  try{
    const response=await call("adminList",{offset:0,limit:200});
    clients=response.rows||[];
    $("login").classList.add("hidden");$("workspace").classList.remove("hidden");
    renderClients();
    if(response.total>200)error("workError","Solo se cargaron 200 clientes. Busca el cliente desde el panel de registros si no aparece aquí.");
    if(desktop){
      $("browserNotice").classList.add("hidden");
      $("desktopBadge").className="mini-status ok";$("desktopBadge").textContent="Escritorio · SRI";
      $("issue").disabled=false;
      await loadSettings();await refreshHistory();
    }else{
      $("desktopBadge").className="mini-status bad";$("desktopBadge").textContent="Web · solo borradores";
      $("configuration").classList.add("hidden");
    }
  }catch(e){
    auth="";sessionStorage.removeItem("nicole_invoice_auth");error("loginError",e.message);
  }
}
$("loginForm").addEventListener("submit",async e=>{
  e.preventDefault();$("loginButton").disabled=true;
  try{const result=await call("adminLogin",{pin:$("pin").value});auth=result.token;sessionStorage.setItem("nicole_invoice_auth",auth);$("pin").value="";await openWorkspace();}
  catch(ex){error("loginError",ex.message);}finally{$("loginButton").disabled=false;}
});
$("logout").addEventListener("click",async()=>{
  try{await call("adminLogout");}catch{}
  auth="";clients=[];selected=null;sessionStorage.removeItem("nicole_invoice_auth");
  $("workspace").classList.add("hidden");$("login").classList.remove("hidden");$("pin").value="";
});
function renderClients(){
  const term=$("clientSearch").value.toLowerCase().trim();
  const list=clients.filter(c=>(String(c.full_name||"")+" "+String(c.id_number||"")).toLowerCase().includes(term));
  $("client").replaceChildren(new Option("Selecciona un cliente",""));
  for(const c of list)$("client").add(new Option(c.full_name+" · "+c.id_number,c.id));
  if(selected&&list.some(c=>c.id===selected.id))$("client").value=selected.id;
}
$("clientSearch").addEventListener("input",renderClients);
$("client").addEventListener("change",()=>{
  selected=clients.find(c=>c.id===$("client").value)||null;
  $("identity").value=selected?selected.id_type+": "+selected.id_number:"";
  $("email").value=selected?.email||"";
});
function addLine(){
  const row=document.createElement("div");
  row.className="line-grid";
  row.innerHTML='<div class="field"><label>Producto</label><input class="description" maxlength="160" placeholder="Descripción"></div><div class="field"><label>Cantidad</label><input class="qty" type="number" min="0.001" step="0.001" value="1"></div><div class="field"><label>Precio $ (sin IVA)</label><input class="price" type="number" min="0" step="0.01" value="0"></div><div class="field"><label>IVA</label><select class="tax"><option value="15">15 %</option><option value="0">0 %</option></select></div><button type="button" class="secondary remove" aria-label="Quitar producto">Quitar</button>';
  row.querySelector(".remove").addEventListener("click",()=>{row.remove();recalculate();});
  row.querySelectorAll("input,select").forEach(x=>x.addEventListener("input",recalculate));
  $("items").append(row);recalculate();
}
function products(){
  return [...$("items").children].map((r,i)=>({
    codigo:String(i+1).padStart(4,"0"),descripcion:r.querySelector(".description").value.trim(),
    cantidad:r.querySelector(".qty").value,precioUnitario:r.querySelector(".price").value,iva:Number(r.querySelector(".tax").value)
  }));
}
function recalculate(){
  let subtotal=0,iva=0;
  for(const row of products()){
    const q=Number(row.cantidad),p=Number(row.precioUnitario);
    if(!Number.isFinite(q)||!Number.isFinite(p)||q<=0||p<0)continue;
    const net=Math.round((q*p+Number.EPSILON)*100)/100;
    subtotal+=net;iva+=Math.round((net*row.iva/100+Number.EPSILON)*100)/100;
  }
  $("subtotal").textContent=money(subtotal);$("tax").textContent=money(iva);$("total").textContent=money(subtotal+iva);
}
$("addItem").addEventListener("click",addLine);addLine();

function fillSettings(c){
  settings=c;
  const f=(id,val)=>$(id).value=val??"";
  f("cfgRuc",c.ruc);f("cfgRazon",c.razonSocial);f("cfgComercial",c.nombreComercial);
  f("cfgDireccion",c.direccionMatriz);f("cfgDireccionEstab",c.direccionEstablecimiento);f("cfgContribEspecial",c.contribuyenteEspecial);f("cfgRimpe",c.contribuyenteRimpe||"");f("cfgEstab",c.estab||"001");f("cfgPto",c.ptoEmi||"001");
  f("cfgSeq",c.nextSeq||1);f("cfgAmbiente",c.ambiente||"pruebas");
  f("cfgPago",c.tipoPago||"01");f("cfgContabilidad",String(!!c.obligadoContabilidad));
  f("cfgCertPath",c.p12Path);f("smtpHost",c.smtpHost);f("smtpPort",c.smtpPort||587);
  f("smtpSecure",String(!!c.smtpSecure));f("smtpUser",c.smtpUser);f("smtpFrom",c.fromEmail);
  $("autoSend").checked=!!c.autoSend;
  $("smtpPassword").placeholder=c.hasSmtpPassword?"Contraseña guardada y cifrada":"Contraseña de aplicación";
  $("environmentNote").className="status-note "+(c.ambiente==="produccion"?"warning":"success-note");
  $("environmentNote").textContent=c.ambiente==="produccion"?
    "PRODUCCIÓN — Cada emisión genera un comprobante real. Verifica RUC, secuencial y habilitación del SRI antes de operar.":
    "PRUEBAS — Los comprobantes no tienen validez tributaria. No los entregues como facturas oficiales.";
}
async function loadSettings(){
  if(!desktop)return;
  try{fillSettings(await desktop.settings());}
  catch(e){error("workError","No se pudo cargar la configuración: "+e.message);}
}
$("saveSettings").addEventListener("click",async()=>{
  if(!desktop)return;
  $("settingsStatus").textContent="";
  const config={
    ruc:$("cfgRuc").value.trim(),razonSocial:$("cfgRazon").value.trim(),nombreComercial:$("cfgComercial").value.trim(),
    direccionMatriz:$("cfgDireccion").value.trim(),direccionEstablecimiento:$("cfgDireccionEstab").value.trim(),contribuyenteEspecial:$("cfgContribEspecial").value.trim(),contribuyenteRimpe:$("cfgRimpe").value,estab:$("cfgEstab").value.trim(),ptoEmi:$("cfgPto").value.trim(),
    nextSeq:Number($("cfgSeq").value),ambiente:$("cfgAmbiente").value,tipoPago:$("cfgPago").value,
    obligadoContabilidad:$("cfgContabilidad").value==="true",confirmProduction:$("cfgAllowProduction").checked,
    smtpHost:$("smtpHost").value.trim(),smtpPort:Number($("smtpPort").value),smtpSecure:$("smtpSecure").value==="true",
    smtpUser:$("smtpUser").value.trim(),fromEmail:$("smtpFrom").value.trim(),
    smtpPassword:$("smtpPassword").value,autoSend:$("autoSend").checked
  };
  try{
    const result=await desktop.saveSettings(config);fillSettings(result);
    $("smtpPassword").value="";$("cfgAllowProduction").checked=false;
    $("settingsStatus").textContent="Configuración guardada en esta computadora.";
    status("Configuración guardada. Puedes preparar una prueba de firma en ambiente de certificación.",true);
  }catch(e){$("settingsStatus").textContent="ERROR: "+e.message;}
});
$("selectCert").addEventListener("click",async()=>{
  if(!desktop)return;
  try{const r=await desktop.selectCertificate();if(!r.canceled){$("cfgCertPath").value=r.path;status("Certificado seleccionado. La contraseña se solicitará al emitir.");}}
  catch(e){error("workError",e.message);}
});
$("issue").addEventListener("click",async()=>{
  if(!desktop){status("La emisión oficial solamente está disponible en la aplicación de escritorio.");return;}
  if(!selected){status("Selecciona primero un cliente.");return;}
  const items=products();
  if(items.some(i=>!i.descripcion||Number(i.cantidad)<=0||Number(i.precioUnitario)<0)){status("Completa las descripciones, cantidades y precios de todos los productos.");return;}
  if(settings?.ambiente==="produccion"&&!$("confirmReal").checked){status("Confirma que la venta es real antes de emitir en producción.");return;}
  setBusy(true);error("workError","");
  try{
    status("Generando XML, firmando con el certificado local y transmitiendo al SRI…");
    const result=await desktop.issue({
      cliente:{tipo:selected.id_type,identificacion:selected.id_number,razonSocial:selected.full_name,email:selected.email||"",telefono:selected.phone||""},
      items,p12Password:$("certPassword").value,confirmProduction:$("confirmReal").checked
    });
    $("certPassword").value="";
    await loadSettings();await refreshHistory();
    if(result.estado==="AUTORIZADO"){
      status("Factura "+result.numero+" AUTORIZADA por el SRI. "+(result.mailSentAt?"Correo enviado al cliente.":"Puedes descargar los documentos y enviar el correo."),true);
    }else{
      status("Comprobante "+result.numero+" — "+result.estado+". "+(result.lastError||"Consulta el estado desde el historial. No vuelvas a emitir la misma venta."));
    }
  }catch(e){$("certPassword").value="";status("No se pudo completar la emisión: "+e.message+". Si alcanzó a reservarse un número, revisa el historial antes de reintentar.");}
  finally{setBusy(false);}
});
async function refreshHistory(){
  if(!desktop)return;
  try{
    const rows=await desktop.list();
    const target=$("history");target.replaceChildren();
    if(!rows.length){const p=document.createElement("p");p.className="help";p.textContent="Todavía no hay comprobantes emitidos desde esta computadora.";target.append(p);return;}
    const table=document.createElement("table"),head=document.createElement("thead"),header=document.createElement("tr");
    for(const title of ["Factura","Fecha","Cliente","Total","Estado","Acciones"]){const th=document.createElement("th");th.textContent=title;header.append(th);}
    head.append(header);table.append(head);const body=document.createElement("tbody");
    for(const r of rows){
      const tr=document.createElement("tr");
      for(const value of [r.numero,new Date(r.createdAt).toLocaleString("es-EC"),r.cliente?.razonSocial||"",money(r.total),r.estado]){
        const td=document.createElement("td");td.textContent=value;tr.append(td);
      }
      const actions=document.createElement("td");const wrap=document.createElement("div");wrap.className="invoice-actions";
      const act=(label,fn)=>{
        const b=document.createElement("button");b.type="button";b.className="secondary";b.textContent=label;
        b.addEventListener("click",async()=>{if(processing)return;setBusy(true);try{await fn();}catch(e){status("Factura "+r.numero+": "+e.message);}finally{setBusy(false);}});
        wrap.append(b);
      };
      act("Consultar SRI",async()=>{
        const v=await desktop.check(r.id);await refreshHistory();
        status("Factura "+v.numero+": "+v.estado+(v.lastError?" — "+v.lastError:""),v.estado==="AUTORIZADO");
      });
      act("XML",async()=>desktop.openFile(r.id,"firmado.xml"));
      if(r.estado==="AUTORIZADO"){
        act("PDF",async()=>desktop.openFile(r.id,"factura.pdf"));
        if(r.ambiente==="produccion")act("Enviar correo",async()=>{
          const v=await desktop.email(r.id);await refreshHistory();status("Correo enviado a "+v.cliente.email,true);
        });
      }
      actions.append(wrap);tr.append(actions);body.append(tr);
    }
    table.append(body);target.append(table);
  }catch(e){error("workError","No se pudo consultar el historial: "+e.message);}
}
$("refreshHistory").addEventListener("click",refreshHistory);
$("copy").addEventListener("click",async()=>{
  if(!selected){error("workError","Selecciona primero un cliente.");return;}
  const lines=["BORRADOR INTERNO — NO ES FACTURA SRI",selected.full_name,selected.id_type+": "+selected.id_number,"Correo: "+selected.email];
  for(const row of products())if(row.descripcion&&Number(row.cantidad)>0)lines.push(row.descripcion+" · "+row.cantidad+" x "+money(row.precioUnitario)+" IVA "+row.iva+" %");
  lines.push("Subtotal: "+$("subtotal").textContent,"IVA: "+$("tax").textContent,"Total: "+$("total").textContent);
  try{await navigator.clipboard.writeText(lines.join("\n"));status("Resumen de borrador copiado.",true);}
  catch{error("workError","No se pudo copiar el resumen.");}
});
if(auth)openWorkspace();
