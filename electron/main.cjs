"use strict";
const {app,BrowserWindow,shell,dialog,session}=require("electron");
const path=require("node:path");
let mainWindow;
const APP_ROOT=path.resolve(__dirname,"..");
const allowedExternal=new Set(["https://jeffer91.github.io","https://nicoleencajes.com","https://www.nicoleencajes.com"]);
function isAllowedExternal(url){try{const u=new URL(url);return u.protocol==="https:"&&allowedExternal.has(u.origin);}catch{return false;}}
function createWindow(){
  mainWindow=new BrowserWindow({
    width:1250,height:840,minWidth:850,minHeight:600,
    title:"Nicole Facturador",
    show:false,
    webPreferences:{
      preload:path.join(__dirname,"preload.cjs"),
      nodeIntegration:false,contextIsolation:true,sandbox:true,
      webSecurity:true,allowRunningInsecureContent:false
    }
  });
  mainWindow.once("ready-to-show",()=>mainWindow.show());
  mainWindow.loadURL("https://jeffer91.github.io/facturas-nicole/facturador/");
  mainWindow.webContents.setWindowOpenHandler(({url})=>{
    if(isAllowedExternal(url))shell.openExternal(url);
    return {action:"deny"};
  });
  mainWindow.webContents.on("will-navigate",(event,url)=>{
    if(!url.startsWith("file://")){event.preventDefault();if(isAllowedExternal(url))shell.openExternal(url);}
  });
  mainWindow.webContents.on("will-attach-webview",event=>event.preventDefault());
  mainWindow.webContents.on("render-process-gone",(_event,details)=>{
    dialog.showErrorBox("Nicole Facturador","La ventana se cerró inesperadamente: "+details.reason);
  });
}
app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));
  session.defaultSession.setPermissionCheckHandler(()=>false);
  createWindow();
  app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});
});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
