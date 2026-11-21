"use strict";
process.env.TZ="America/Guayaquil";
const {app,BrowserWindow,shell,dialog,session,ipcMain}=require("electron");
const path=require("node:path");
const {pathToFileURL}=require("node:url");
const fs=require("node:fs");
const {createSriService}=require("./sri-service.cjs");

let mainWindow,sriService;
const authorizedWindows=new Map();
const root=path.resolve(__dirname,"..");
const html=path.resolve(root,"site","facturador","index.html");
const localURL=pathToFileURL(html).href;
const apiURL="https://oppaviqjlyrnkpxjsfvo.supabase.co/functions/v1/invoice-api";
const allowedExternal=new Set(["https://jeffer91.github.io","https://nicoleencajes.com","https://www.nicoleencajes.com","https://www.sri.gob.ec","https://github.com"]);
const allowedAPI=new Set(["adminLogin","adminList","adminLogout"]);
function isAllowedExternal(url){try{const u=new URL(url);return u.protocol==="https:"&&allowedExternal.has(u.origin);}catch{return false;}}
function trusted(event){if(!event.senderFrame||event.senderFrame.url!==localURL)throw Error("Origen no autorizado para operación local.");}
function installHandlers(){
  function bind(channel,handler){
    ipcMain.handle("nicole:"+channel,async(e,...args)=>{
      trusted(e);
      if(channel!=="api"){
        const login=authorizedWindows.get(e.sender.id);
        if(!login||login.expires<Date.now())throw Error("Inicia sesión como administrador antes de operar el SRI.");
      }
      return await handler(...args,e.sender.id);
    });
  }
  bind("api",async(action,body={},token="",senderId)=>{
    if(!allowedAPI.has(action))throw Error("Acción no permitida.");
    const encoded=JSON.stringify({action,...body});
    if(encoded.length>12000||String(token).length>1500)throw Error("Solicitud demasiado grande.");
    const res=await fetch(apiURL,{method:"POST",headers:{"content-type":"application/json",...(token?{"x-almacen-key":String(token)}:{})},body:encoded,signal:AbortSignal.timeout(20000)});
    const result=await res.json();
    if(!res.ok||!result.ok)throw Error(String(result.error||"Error del servicio de clientes").slice(0,200));
    if(action==="adminLogout")authorizedWindows.delete(senderId);
    if((action==="adminLogin"&&result.token)||(action==="adminList"&&token))
      authorizedWindows.set(senderId,{expires:Date.now()+8*3600*1000});
    return result;
  });
  bind("settings",()=>sriService.settings());
  bind("saveSettings",value=>sriService.saveSettings(value));
  bind("certificate",()=>sriService.selectCertificate(dialog));
  bind("list",()=>sriService.list());
  bind("issue",value=>sriService.issue(value));
  bind("check",id=>sriService.check(id));
  bind("email",id=>sriService.email(id));
  bind("openFile",async(id,kind)=>{
    const file=sriService.file(id,kind);
    if(!fs.existsSync(file))throw Error("Archivo no encontrado.");
    const result=await shell.openPath(file);
    if(result)throw Error(result);
    return true;
  });
}
function createWindow(){
  mainWindow=new BrowserWindow({
    width:1240,height:900,minWidth:900,minHeight:650,
    title:"Nicole Facturador • Emisión SRI",
    show:false,
    webPreferences:{
      preload:path.join(__dirname,"preload.cjs"),
      nodeIntegration:false,contextIsolation:true,sandbox:true,
      webSecurity:true,allowRunningInsecureContent:false
    }
  });
  mainWindow.once("ready-to-show",()=>mainWindow.show());
  mainWindow.webContents.once("destroyed",()=>authorizedWindows.clear());
  mainWindow.loadFile(html);
  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    if(url.startsWith(pathToFileURL(path.join(root,"site","admin")).href))
      shell.openExternal("https://jeffer91.github.io/facturas-nicole/admin/");
    else if(isAllowedExternal(url))shell.openExternal(url);
    return {action:"deny"};
  });
  mainWindow.webContents.on("will-navigate",(e,url)=>{
    if(url===localURL)return;
    e.preventDefault();
    // Enlaces de administración se abren en el navegador, sin privilegios locales.
    if(url.startsWith(pathToFileURL(path.join(root,"site","admin")).href)){
      shell.openExternal("https://jeffer91.github.io/facturas-nicole/admin/");
    }else if(isAllowedExternal(url))shell.openExternal(url);
  });
  mainWindow.webContents.on("will-attach-webview",event=>event.preventDefault());
  mainWindow.webContents.on("render-process-gone",(_event,details)=>
    dialog.showErrorBox("Nicole Facturador","La ventana se cerró inesperadamente: "+details.reason));
}
app.whenReady().then(()=>{
  sriService=createSriService(app.getPath("userData"));
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  installHandlers();
  createWindow();
  app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
