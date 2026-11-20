import { createClient } from "jsr:@supabase/supabase-js@2";

const db=createClient(Deno.env.get("SUPABASE_URL")||"",Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"",{auth:{persistSession:false,autoRefreshToken:false}});
const secret=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")||"";
const txt=(x:unknown,n=200)=>String(x??"").trim().slice(0,n);
const allowed=new Set(["https://jeffer91.github.io","https://nicoleencajes.com","https://www.nicoleencajes.com"]);
function h(origin:string|null){return {"access-control-allow-origin":origin&&allowed.has(origin)?origin:"https://jeffer91.github.io","vary":"Origin","access-control-allow-headers":"content-type,x-almacen-key","access-control-allow-methods":"POST,OPTIONS","content-type":"application/json; charset=utf-8","cache-control":"no-store"};}
function resp(data:unknown,status=200,origin:string|null=null){return new Response(JSON.stringify(data),{status,headers:h(origin)});}
async function sha(s:string){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(s));return Array.from(new Uint8Array(b),n=>n.toString(16).padStart(2,"0")).join("");}
const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,"0")).join("");
function cedula(s:string){if(!/^\d{10}$/.test(s))return false;let p=+s.slice(0,2);if(!((p>=1&&p<=24)||p===30)||+s[2]>=6)return false;let total=0;for(let i=0;i<9;i++){let n=+s[i]*(i%2?1:2);total+=n>9?n-9:n;}return (10-total%10)%10===+s[9];}
function client(b:Record<string,unknown>){
 const id_type=txt(b.id_type,20),id_number=txt(b.id_number,21).replace(/[\s-]/g,"").toUpperCase(),
 full_name=txt(b.full_name,201),email=txt(b.email,201).toLowerCase(),phone=txt(b.phone,31).replace(/[\s()-]/g,""),address=txt(b.address,241);
 if(!["cedula","ruc","pasaporte"].includes(id_type))throw Error("Selecciona tu tipo de identificación");
 if(id_type==="cedula"&&!cedula(id_number))throw Error("La cédula no es válida");
 if(id_type==="ruc"&&(!/^\d{13}$/.test(id_number)||+id_number.slice(-3)===0))throw Error("El RUC debe tener 13 dígitos");
 if(id_type==="pasaporte"&&!/^[A-Z0-9]{5,20}$/.test(id_number))throw Error("Revisa el número de pasaporte");
 if(full_name.length<3||full_name.length>200)throw Error("Escribe tus nombres completos o razón social");
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>200)throw Error("Ingresa un correo válido");
 if(!/^\+?\d{9,15}$/.test(phone))throw Error("El celular es obligatorio y debe tener entre 9 y 15 dígitos");
 if(address.length>240)throw Error("La dirección es muy larga");
 if(b.privacy_accepted!==true)throw Error("Debes aceptar el uso de datos para la facturación");
 return {id_type,id_number,full_name,email,phone,address};
}
async function limit(req:Request,name:string,max:number,period:number){
 const ip=req.headers.get("cf-connecting-ip")||req.headers.get("x-real-ip")||req.headers.get("x-forwarded-for")?.split(",")[0]||"unknown";
 const key=await sha(secret.slice(0,32)+":invoice:"+name+":"+ip);
 const {data,error}=await db.rpc("invoice_rate_limit",{p_bucket_hash:key,p_threshold:max,p_window_seconds:period});if(error)throw error;return !data;
}
async function getSession(req:Request){
 const key=req.headers.get("x-almacen-key")||"";if(!/^[a-f0-9]{64}$/.test(key))return null;const hashed=await sha(key);
 const {data,error}=await db.from("invoice_admin_sessions").select("token_hash").eq("token_hash",hashed).gt("expires_at",new Date().toISOString()).maybeSingle();if(error)throw error;return data?hashed:null;
}

const PHOTO_BUCKET="nicole-invoice-receipts";
function decodePhoto(b:Record<string,unknown>) {
 if(!b.receipt_base64)return null;
 const base64=b.receipt_base64, mime=b.receipt_mime;
 if(typeof base64!=="string"||base64.length>2900000||!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))throw Error("Fotografía inválida o demasiado grande (máximo 2 MB)");
 if(!["image/jpeg","image/png","image/webp"].includes(String(mime)))throw Error("Solo se permiten imágenes JPG, PNG o WebP");
 let bytes:Uint8Array;
 try{bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));}catch{throw Error("No se pudo procesar la imagen");}
 if(bytes.length<128||bytes.length>2097152)throw Error("La fotografía debe pesar menos de 2 MB");
 const jpeg=mime==="image/jpeg"&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
 const png=mime==="image/png"&&[137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x);
 const webp=mime==="image/webp"&&[82,73,70,70].every((x,i)=>bytes[i]===x)&&[87,69,66,80].every((x,i)=>bytes[i+8]===x);
 if(!jpeg&&!png&&!webp)throw Error("El archivo no es una imagen válida");
 return {bytes,mime:String(mime),ext:jpeg?"jpg":png?"png":"webp"};
}

Deno.serve(async(req:Request)=>{
 const origin=req.headers.get("origin");
 if(req.method==="OPTIONS")return new Response(null,{status:204,headers:h(origin)});
 if(req.method!=="POST")return resp({ok:false,error:"Método no permitido"},405,origin);
 try{
  const b=await req.json();if(!b||typeof b!=="object"||Array.isArray(b))return resp({ok:false,error:"Solicitud inválida"},400,origin);
  const action=txt(b.action,40);
  if(action==="register"){
   if(b.website)return resp({ok:true},200,origin);
   if(await limit(req,"register",10,3600))return resp({ok:false,error:"Demasiadas solicitudes. Intenta más tarde."},429,origin);
   let data;try{data=client(b);}catch(e){return resp({ok:false,error:(e as Error).message},400,origin);}
   let photo;try{photo=decodePhoto(b);}catch(e){return resp({ok:false,error:(e as Error).message},400,origin);}
   const id=crypto.randomUUID();
   const path=photo?id+"/comprobante-"+crypto.randomUUID()+"."+photo.ext:null;
   let uploaded=false;
   try{
     if(photo&&path){const s=await db.storage.from(PHOTO_BUCKET).upload(path,photo.bytes,{contentType:photo.mime,cacheControl:"0",upsert:false});if(s.error)throw s.error;uploaded=true;}
     const {error}=await db.from("invoice_client_registrations").insert({id,...data,privacy_accepted_at:new Date().toISOString(),receipt_storage_path:path,receipt_mime:photo?.mime||null,receipt_uploaded_at:photo?new Date().toISOString():null});
     if(error)throw error;
   }catch(e){if(uploaded&&path)await db.storage.from(PHOTO_BUCKET).remove([path]);throw e;}
   return resp({ok:true,message:"Tus datos y tu comprobante se guardaron correctamente"},200,origin);
  }
  if(action==="adminLogin"){
   if(await limit(req,"adminLogin",12,3600))return resp({ok:false,error:"Demasiados intentos. Intenta más tarde."},429,origin);
   const {data,error}=await db.rpc("invoice_verify_pin",{p_candidate:txt(b.pin,12)});if(error)throw error;
   if(data!==true)return resp({ok:false,error:"PIN incorrecto o acceso bloqueado temporalmente"},401,origin);
   const key=token(),hashed=await sha(key);
   const result=await db.from("invoice_admin_sessions").insert({token_hash:hashed,expires_at:new Date(Date.now()+8*3600000).toISOString()});if(result.error)throw result.error;
   return resp({ok:true,token:key,expires_in:28800},200,origin);
  }
  const session=await getSession(req);if(!session)return resp({ok:false,error:"Sesión no autorizada o vencida"},401,origin);
  if(action==="adminList"){
   const offset=Math.max(0,Math.min(50000,Math.floor(+b.offset||0))),size=Math.max(1,Math.min(200,Math.floor(+b.limit||100)));
   let q=db.from("invoice_client_registrations").select("id,id_type,id_number,full_name,email,phone,address,status,invoice_reference,created_at,managed_at,receipt_storage_path",{count:"exact"});
   if(b.status==="pendiente"||b.status==="gestionado")q=q.eq("status",b.status);
   const {data,count,error}=await q.order("created_at",{ascending:false}).order("id",{ascending:false}).range(offset,offset+size-1);if(error)throw error;
   const rows=(data||[]).map(({receipt_storage_path,...r})=>({...r,has_receipt:!!receipt_storage_path}));
   return resp({ok:true,rows,total:count||0,offset,limit:size},200,origin);
  }
  if(action==="adminReceipt"){
   const id=txt(b.id,40);if(!/^[a-f0-9-]{36}$/i.test(id))return resp({ok:false,error:"Identificador inválido"},400,origin);
   const {data,error}=await db.from("invoice_client_registrations").select("receipt_storage_path").eq("id",id).maybeSingle();
   if(error)throw error;
   if(!data?.receipt_storage_path)return resp({ok:false,error:"Este cliente no adjuntó una fotografía"},404,origin);
   const s=await db.storage.from(PHOTO_BUCKET).createSignedUrl(data.receipt_storage_path,120);
   if(s.error)throw s.error;
   return resp({ok:true,url:s.data.signedUrl,expires_in:120},200,origin);
  }
  if(action==="adminMark"){
   const id=txt(b.id,40);if(!/^[a-f0-9-]{36}$/i.test(id))return resp({ok:false,error:"Identificador inválido"},400,origin);
   const completed=b.completed===true,reference=txt(b.invoice_reference,101);if(reference.length>100)return resp({ok:false,error:"Referencia demasiado larga"},400,origin);
   const {data,error}=await db.from("invoice_client_registrations").update({status:completed?"gestionado":"pendiente",invoice_reference:completed?reference:"",managed_at:completed?new Date().toISOString():null}).eq("id",id).select("id").maybeSingle();if(error)throw error;
   if(!data)return resp({ok:false,error:"Registro no encontrado"},404,origin);return resp({ok:true},200,origin);
  }
  if(action==="adminLogout"){await db.from("invoice_admin_sessions").delete().eq("token_hash",session);return resp({ok:true},200,origin);}
  return resp({ok:false,error:"Acción desconocida"},400,origin);
 }catch(error){console.error("invoice-api",error);return resp({ok:false,error:"Error del servidor. Intenta nuevamente."},500,origin);}
});