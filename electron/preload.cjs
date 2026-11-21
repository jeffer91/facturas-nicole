"use strict";
const {contextBridge,ipcRenderer}=require("electron");
// Los secretos se procesan exclusivamente en el proceso principal de Electron.
// No se expone require(), sistema de archivos, certificados ni APIs arbitrarias.
const invoke=(channel,...args)=>ipcRenderer.invoke("nicole:"+channel,...args);
contextBridge.exposeInMainWorld("nicoleDesktop",Object.freeze({
  api:(action,body,token)=>invoke("api",action,body,token),
  settings:()=>invoke("settings"),
  saveSettings:settings=>invoke("saveSettings",settings),
  selectCertificate:()=>invoke("certificate"),
  list:()=>invoke("list"),
  issue:invoice=>invoke("issue",invoice),
  check:id=>invoke("check",id),
  email:id=>invoke("email",id),
  openFile:(id,kind)=>invoke("openFile",id,kind)
}));
