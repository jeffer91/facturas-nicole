"use strict";
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
const {safeStorage} = require("electron");

const validEnv = new Set(["pruebas","produccion"]);
const money = n => (Math.round(Number(n) * 100) / 100).toFixed(2);
const digits = (v,n) => String(v||"").padStart(n,"0");
const str = (v) => String(v??"").trim();
const positive = (v) => Number.isFinite(Number(v)) && Number(v)>0;
const allowedIdTypes={cedula:"05",cédula:"05",ruc:"04",pasaporte:"06",passport:"06"};
const timestamp=()=>new Date().toISOString();
const identifier=(a)=>{const p=str(a);if(!/^\d{13}$/.test(p))throw Error("RUC del emisor: ingresa 13 dígitos.");return p;};

class DiskStore {
  constructor(root){
    this.dir=path.join(root,"sri-facturas");
    this.docs=path.join(this.dir,"documentos");
    fs.mkdirSync(this.docs,{recursive:true,mode:0o700});
    this.configPath=path.join(this.dir,"config.json");
    this.ledgerPath=path.join(this.dir,"comprobantes.json");
    this.smtpSecretPath=path.join(this.dir,"smtp.enc");
  }
  read(p,fallback){if(!fs.existsSync(p))return fallback;return JSON.parse(fs.readFileSync(p,"utf8"));}
  write(p,obj){
    const temp=p+"."+process.pid+"."+crypto.randomBytes(4).toString("hex")+".tmp";
    fs.writeFileSync(temp,JSON.stringify(obj,null,2),{mode:0o600,flag:"wx"});
    fs.renameSync(temp,p);
  }
  config(){
    const cfg=this.read(this.configPath,{ambiente:"pruebas",nextSeq:1,estab:"001",ptoEmi:"001",obligadoContabilidad:false,tipoPago:"01",smtpPort:587,smtpSecure:false,autoSend:false});
    const max=this.ledger().records.filter(r=>r.ruc===cfg.ruc&&r.estab===cfg.estab&&r.ptoEmi===cfg.ptoEmi).reduce((m,r)=>Math.max(m,r.seq),0);
    cfg.nextSeq=Math.max(Number(cfg.nextSeq)||1,max+1);
    return cfg;
  }
  ledger(){return this.read(this.ledgerPath,{records:[]});}
  list(){return this.ledger().records.slice().reverse().map(r=>({...r,items:undefined}));}
  get(id){return this.ledger().records.find(r=>r.id===id);}
  saveConfig(next){
    const current=this.config(), all=this.ledger().records;
    const cfg={...current,...next};
    if(!validEnv.has(cfg.ambiente))throw Error("Ambiente inválido.");
    if(!/^\d{3}$/.test(str(cfg.estab))||!/^\d{3}$/.test(str(cfg.ptoEmi)))throw Error("Establecimiento y punto: exactamente 3 dígitos.");
    if(cfg.ruc)identifier(cfg.ruc);
    const n=Number(cfg.nextSeq);
    if(!Number.isSafeInteger(n)||n<1||n>999999999)throw Error("Secuencial inicial inválido.");
    const same=all.filter(x=>x.ruc===cfg.ruc&&x.estab===cfg.estab&&x.ptoEmi===cfg.ptoEmi);
    const max=same.reduce((m,x)=>Math.max(m,x.seq),0);
    if(n<=max)throw Error("El secuencial debe superar el último reservado en este equipo ("+max+").");
    if(current.ambiente==="pruebas"&&cfg.ambiente==="produccion"&&!cfg.confirmProduction)throw Error("Confirma expresamente la activación de producción.");
    delete cfg.confirmProduction;
    for(const key of ["p12Password","smtpPassword","pin","auth","token"])delete cfg[key];
    this.write(this.configPath,cfg);
    return cfg;
  }
  reserve(rec){
    const ledger=this.ledger();
    if(ledger.records.some(r=>r.id===rec.id||r.claveAcceso===rec.claveAcceso||
      (r.ruc===rec.ruc&&r.estab===rec.estab&&r.ptoEmi===rec.ptoEmi&&r.seq===rec.seq)))
      throw Error("Factura o secuencial duplicado.");
    ledger.records.push(rec);
    this.write(this.ledgerPath,ledger);
    const c=this.config();
    c.nextSeq=rec.seq+1;
    this.write(this.configPath,c);
  }
  update(id,patch){
    const d=this.ledger(),r=d.records.find(x=>x.id===id);
    if(!r)throw Error("Factura no encontrada.");
    Object.assign(r,patch,{updatedAt:timestamp()});
    this.write(this.ledgerPath,d);
    return r;
  }
  folder(id){if(!/^[a-f0-9-]{36}$/.test(id))throw Error("ID inválido.");const f=path.join(this.docs,id);fs.mkdirSync(f,{recursive:true,mode:0o700});return f;}
  file(id,name){return path.join(this.folder(id),name);}
  saveSmtpPassword(secret){
    if(!safeStorage.isEncryptionAvailable())throw Error("El cifrado seguro del sistema operativo no está disponible. No se guardó la contraseña SMTP.");
    fs.writeFileSync(this.smtpSecretPath,safeStorage.encryptString(secret),{mode:0o600});
  }
  smtpPassword(){
    if(!fs.existsSync(this.smtpSecretPath))return "";
    if(!safeStorage.isEncryptionAvailable())throw Error("No se puede descifrar la contraseña SMTP.");
    return safeStorage.decryptString(fs.readFileSync(this.smtpSecretPath));
  }
  hasSmtpPassword(){return fs.existsSync(this.smtpSecretPath);}
}

function validateOrder(order,cfg) {
  if(!cfg.ruc||!cfg.razonSocial||!cfg.direccionMatriz)throw Error("Completa RUC, razón social y dirección matriz en Configuración.");
  if(!cfg.p12Path||!fs.existsSync(cfg.p12Path))throw Error("Selecciona un certificado P12/PFX que exista en este equipo.");
  if(!str(order.p12Password))throw Error("Introduce la contraseña de tu firma electrónica para emitir.");
  const c=order.cliente;
  if(!c||!str(c.razonSocial)||!str(c.identificacion))throw Error("Selecciona un cliente con nombre e identificación.");
  if(!allowedIdTypes[str(c.tipo).toLowerCase()])throw Error("Tipo de identificación no admitido.");
  if(!Array.isArray(order.items)||order.items.length<1||order.items.length>100)throw Error("La factura necesita de 1 a 100 productos.");
  for(const item of order.items){
    if(!str(item.descripcion)||str(item.descripcion).length>300)throw Error("Cada producto necesita una descripción (máximo 300 caracteres).");
    if(!positive(item.cantidad)||Number(item.precioUnitario)<0||!Number.isFinite(Number(item.precioUnitario)))throw Error("Cantidad y precio no válidos.");
    if(![0,15].includes(Number(item.iva)))throw Error("Solo se admiten tarifas verificadas de 0 % o 15 %. Revisa otros tratamientos tributarios.");
  }
}

function buildLines(order){
  // Cálculo en milésimas de cantidad y diezmilésimas de precio; al final se redondea cada renglón.
  const lines=order.items.map((item,i)=>{
    const q=Number(item.cantidad),unit=Number(item.precioUnitario),tarifa=Number(item.iva);
    if(q>999999||unit>999999999||q.toString().length>20)throw Error("Cantidad o precio fuera de rango.");
    const net=Math.round((q*unit+Number.EPSILON)*100)/100;
    const tax=Math.round((net*tarifa/100+Number.EPSILON)*100)/100;
    return {codigoPrincipal:str(item.codigo)||digits(i+1,4),descripcion:str(item.descripcion),
      cantidad:str(item.cantidad),precioUnitario:money(unit),descuento:"0.00",precioTotalSinImpuesto:money(net),
      impuestos:[{codigo:"2",codigoPorcentaje:tarifa===15?"4":"0",tarifa:String(tarifa),baseImponible:money(net),valor:money(tax)}],
      _net:net,_tax:tax,_tarifa:tarifa};
  });
  const total=lines.reduce((s,i)=>s+Math.round((i._net+i._tax)*100),0)/100;
  if(total<=0)throw Error("El total de la factura debe ser mayor a cero.");
  return {lines:lines.map(({_net,_tax,_tarifa,...x})=>x),total,iva:lines.reduce((s,i)=>s+Math.round(i._tax*100),0)/100,base:lines.reduce((s,i)=>s+Math.round(i._net*100),0)/100};
}

async function makeRide(file,record,cfg) {
  return new Promise((resolve,reject)=>{
    const pdf=new PDFDocument({size:"A4",margin:40,info:{Title:"Factura "+record.numero,Author:cfg.razonSocial}});
    const output=fs.createWriteStream(file,{flags:"w",mode:0o600});
    pdf.on("error",reject);output.on("error",reject);output.on("finish",resolve);pdf.pipe(output);
    pdf.font("Helvetica-Bold").fontSize(19).text(cfg.nombreComercial||cfg.razonSocial,{align:"center"});
    pdf.font("Helvetica").fontSize(10).text(cfg.razonSocial,{align:"center"});
    pdf.moveDown().font("Helvetica-Bold").fontSize(14).text("FACTURA ELECTRÓNICA",{align:"center"});
    pdf.font("Helvetica").fontSize(10).text("RUC: "+cfg.ruc).text("Factura: "+record.numero)
      .text("Ambiente: "+record.ambiente.toUpperCase()).text("Estado SRI: "+record.estado)
      .text("Autorización: "+(record.numeroAutorizacion||"Pendiente"))
      .text("Fecha: "+new Date(record.createdAt).toLocaleString("es-EC",{timeZone:"America/Guayaquil"}))
      .text("Dirección matriz: "+cfg.direccionMatriz);
    pdf.moveDown().font("Helvetica-Bold").text("CLIENTE").font("Helvetica").text(record.cliente.razonSocial)
      .text("Identificación: "+record.cliente.identificacion).text("Correo: "+(record.cliente.email||"No indicado"));
    pdf.moveDown().font("Helvetica-Bold").text("DETALLE DE PRODUCTOS").moveDown(0.3);
    pdf.font("Helvetica").fontSize(9);
    for(const item of record.items){
      if(pdf.y>695)pdf.addPage();
      pdf.text(item.descripcion+"  |  "+item.cantidad+" × $"+money(item.precioUnitario)+"  |  IVA "+item.iva+" %  |  $"+money(Number(item.cantidad)*Number(item.precioUnitario)),{width:510});
    }
    pdf.moveDown().font("Helvetica-Bold").fontSize(11).text("Subtotal: $"+money(record.base),{align:"right"})
      .text("IVA: $"+money(record.iva),{align:"right"})
      .text("TOTAL: $"+money(record.total),{align:"right"});
    pdf.moveDown().font("Helvetica").fontSize(8).text("CLAVE DE ACCESO: "+record.claveAcceso,{align:"center"});
    pdf.text("La validez tributaria corresponde al XML firmado y autorizado por el SRI.",{align:"center"});
    pdf.end();
  });
}

function safeMessage(e){return str(e?.message||e).slice(0,500).replace(/(password|contraseña|secret|token)[=: ]+\S+/gi,"$1=[oculto]");}
function normalizeStatus(response,defaultStatus="PENDIENTE"){
  const raw=str(response?.estado||response?.autorizacion?.estado||response?.autorizaciones?.find?.(x=>x.estado==="AUTORIZADO")?.estado||response?.autorizaciones?.[0]?.estado||defaultStatus).toUpperCase();
  const estado=raw==="NO AUTORIZADO"?"NO_AUTORIZADO":raw;
  return ["AUTORIZADO","NO_AUTORIZADO","DEVUELTA","PENDIENTE"].includes(estado)?estado:defaultStatus;
}

function createSriService(userDataPath){
  const store=new DiskStore(userDataPath);
  let busy=false;
  const ensureIdle=()=>{if(busy)throw Error("Ya hay otra operación de facturación en curso.");busy=true;};
  const release=()=>{busy=false;};
  async function sdk(){
    const [core,xml,signature,sri]=await Promise.all([
      import("@ecuador-tax/core"),import("@ecuador-tax/xml"),import("@ecuador-tax/signature"),import("@ecuador-tax/sri")
    ]);
    return {core,xml,signature,sri};
  }
  async function consultInternal(id,client){
    const rec=store.get(id);if(!rec)throw Error("Factura no encontrada.");
    if(!rec.claveAcceso)throw Error("La factura aún no tiene clave de acceso.");
    const {core,sri}=client||await sdk();
    const s=new sri.SriClient({ambiente:rec.ambiente==="pruebas"?core.Ambiente.Pruebas:core.Ambiente.Produccion});
    const result=await s.autorizacion(rec.claveAcceso);
    let estado=normalizeStatus(result);
    const auth=result?.autorizaciones?.find?.(x=>x.estado==="AUTORIZADO")
      ||result?.autorizaciones?.find?.(x=>x.estado==="NO AUTORIZADO")
      ||result?.autorizaciones?.[0]||result?.autorizacion||{};
    const patch={estado,ultimoResultado:JSON.stringify(result).slice(0,15000),lastError:""};
    if(estado==="AUTORIZADO"){
      patch.numeroAutorizacion=str(auth.numeroAutorizacion||rec.claveAcceso);
      patch.fechaAutorizacion=str(auth.fechaAutorizacion||"");
      const xml=auth.comprobante;
      if(xml)fs.writeFileSync(store.file(id,"autorizado.xml"),String(xml),{mode:0o600});
    }
    store.update(id,patch);
    if(estado==="AUTORIZADO"){
      await makeRide(store.file(id,"factura.pdf"),store.get(id),store.config());
      if(store.get(id).ambiente==="produccion"&&!store.get(id).mailSentAt&&store.config().autoSend&&store.hasSmtpPassword()){
        try{await emailInternal(id);}catch(e){store.update(id,{mailError:safeMessage(e)});}
      }
    }
    return store.get(id);
  }
  async function transmit(id,lib){
    const rec=store.get(id);
    if(!rec)throw Error("Factura no encontrada.");
    if(rec.estado==="AUTORIZADO")return rec;
    const signed=fs.readFileSync(store.file(id,"firmado.xml"),"utf8");
    const {core,sri}=lib||await sdk();
    const s=new sri.SriClient({ambiente:rec.ambiente==="pruebas"?core.Ambiente.Pruebas:core.Ambiente.Produccion});
    store.update(id,{estado:"TRANSMITIENDO",lastError:""});
    let result;
    try{result=await s.enviarYAutorizar(signed,rec.claveAcceso);}
    catch(e){
      // El SRI puede haber recibido una solicitud que perdió conexión; no reenviar con otro secuencial.
      store.update(id,{estado:"PENDIENTE",lastError:safeMessage(e)});
      return store.get(id);
    }
    let estado=normalizeStatus(result);
    const auth=result?.autorizacion||{};
    const patch={estado,ultimoResultado:JSON.stringify(result).slice(0,15000),lastError:""};
    if(estado==="AUTORIZADO"){
      patch.numeroAutorizacion=str(auth.numeroAutorizacion||rec.claveAcceso);
      patch.fechaAutorizacion=str(auth.fechaAutorizacion||"");
      if(auth.comprobante)fs.writeFileSync(store.file(id,"autorizado.xml"),String(auth.comprobante),{mode:0o600});
    }else if(estado!=="PENDIENTE")patch.lastError=JSON.stringify(result?.recepcion?.comprobantes||result?.autorizacion?.mensajes||result).slice(0,1200);
    store.update(id,patch);
    if(estado==="AUTORIZADO"){
      await makeRide(store.file(id,"factura.pdf"),store.get(id),store.config());
      if(store.config().autoSend&&store.hasSmtpPassword()){
        try{await emailInternal(id);}catch(e){store.update(id,{mailError:safeMessage(e)});}
      }
    }
    return store.get(id);
  }
  async function issue(order){
    ensureIdle();
    try{
      const cfg=store.config();
      validateOrder(order,cfg);
      if(cfg.ambiente==="produccion"&&order.confirmProduction!==true)throw Error("Para producir necesitas confirmar expresamente que la venta es real y el RUC está habilitado.");
      const totals=buildLines(order);
      const lib=await sdk();
      const creds=lib.signature.loadCredentialsFromP12(fs.readFileSync(cfg.p12Path),order.p12Password);
      const seq=Number(cfg.nextSeq);
      const c=order.cliente;
      const numero=cfg.estab+"-"+cfg.ptoEmi+"-"+digits(seq,9);
      const emisor={ruc:identifier(cfg.ruc),razonSocial:str(cfg.razonSocial),nombreComercial:str(cfg.nombreComercial)||undefined,
        establecimiento:cfg.estab,puntoEmision:cfg.ptoEmi,direccionMatriz:str(cfg.direccionMatriz),
        obligadoContabilidad:!!cfg.obligadoContabilidad};
      const draft=lib.xml.buildFacturaXml({
        ambiente:cfg.ambiente==="pruebas"?lib.core.Ambiente.Pruebas:lib.core.Ambiente.Produccion,
        fechaEmision:new Date(),secuencial:digits(seq,9),emisor,
        comprador:{tipoIdentificacion:allowedIdTypes[str(c.tipo).toLowerCase()],identificacion:str(c.identificacion),razonSocial:str(c.razonSocial)},
        detalles:totals.lines,pagos:[{formaPago:str(cfg.tipoPago||"01"),total:money(totals.total)}]
      });
      const signed=lib.signature.signXml(draft.xml,creds);
      if(!/^\d{49}$/.test(draft.claveAcceso))throw Error("El XML no generó una clave de acceso correcta.");
      const id=crypto.randomUUID();
      const rec={id,seq,numero,claveAcceso:draft.claveAcceso,ambiente:cfg.ambiente,
        ruc:cfg.ruc,estab:cfg.estab,ptoEmi:cfg.ptoEmi,createdAt:timestamp(),updatedAt:timestamp(),
        cliente:{...c},items:order.items.map(i=>({...i})),base:totals.base,iva:totals.iva,total:totals.total,
        estado:"PREPARADA",numeroAutorizacion:"",mailSentAt:"",lastError:""};
      store.reserve(rec);
      fs.writeFileSync(store.file(id,"firmado.xml"),signed,{mode:0o600});
      return await transmit(id,lib);
    }finally{release();}
  }
  async function check(id){
    ensureIdle();try{const r=await consultInternal(id);return r;}catch(e){
      if(store.get(id))store.update(id,{estado:store.get(id).estado==="AUTORIZADO"?"AUTORIZADO":"PENDIENTE",lastError:safeMessage(e)});
      throw e;
    }finally{release();}
  }
  async function emailInternal(id){
    const rec=store.get(id);if(!rec||rec.estado!=="AUTORIZADO")throw Error("Solo se envían comprobantes autorizados.");
    const cfg=store.config();
    if(rec.ambiente!=="produccion")throw Error("No enviar comprobantes de pruebas como facturas reales.");
    if(!cfg.smtpHost||!cfg.smtpUser||!cfg.fromEmail)throw Error("Configura servidor SMTP, usuario y remitente.");
    if(!rec.cliente.email||!String(rec.cliente.email).includes("@"))throw Error("El cliente no tiene correo válido.");
    const transport=nodemailer.createTransport({host:cfg.smtpHost,port:Number(cfg.smtpPort)||587,secure:!!cfg.smtpSecure,
      auth:{user:cfg.smtpUser,pass:store.smtpPassword()},tls:{rejectUnauthorized:true}});
    await transport.sendMail({from:cfg.fromEmail,to:rec.cliente.email,
      subject:"Factura electrónica "+rec.numero+" - "+(cfg.nombreComercial||cfg.razonSocial),
      text:"Adjuntamos su factura electrónica autorizada por el SRI en XML y su representación PDF.",
      attachments:[{filename:rec.numero+".xml",path:fs.existsSync(store.file(id,"autorizado.xml"))?store.file(id,"autorizado.xml"):store.file(id,"firmado.xml")},
        {filename:rec.numero+".pdf",path:store.file(id,"factura.pdf")}]
    });
    store.update(id,{mailSentAt:timestamp(),mailError:""});
    return store.get(id);
  }
  async function email(id){ensureIdle();try{return await emailInternal(id);}finally{release();}}
  async function selectCertificate(dialog){
    if(busy)throw Error("Espera a que termine la operación en curso.");
    const x=await dialog.showOpenDialog({title:"Elegir certificado de firma electrónica",properties:["openFile"],filters:[{name:"Firma electrónica P12/PFX",extensions:["p12","pfx"]}]});
    if(x.canceled||!x.filePaths[0])return {canceled:true};
    const cfg=store.config();store.saveConfig({...cfg,p12Path:x.filePaths[0]});
    return {path:x.filePaths[0]};
  }
  return {
    settings:()=>{const c=store.config();return {...c,hasSmtpPassword:store.hasSmtpPassword()};},
    saveSettings:({smtpPassword,...config})=>{if(busy)throw Error("No cambies la configuración durante una emisión.");const c=store.saveConfig(config);if(smtpPassword)store.saveSmtpPassword(smtpPassword);return {...c,hasSmtpPassword:store.hasSmtpPassword()};},
    selectCertificate,
    list:()=>store.list(),
    issue,
    check,
    email,
    get: id=>store.get(id),
    file: (id,kind)=>{const rec=store.get(id);if(!rec)throw Error("Factura no encontrada.");if(!["firmado.xml","autorizado.xml","factura.pdf"].includes(kind))throw Error("Archivo inválido.");const p=store.file(id,kind);if(!fs.existsSync(p))throw Error("El archivo todavía no existe.");return p;}
  };
}
module.exports={createSriService,DiskStore,buildLines,validateOrder,normalizeStatus};
