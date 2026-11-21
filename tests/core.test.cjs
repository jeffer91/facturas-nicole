"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const os=require("node:os");
const path=require("node:path");
const {buildLines,DiskStore,validateOrder,normalizeStatus}=require("../electron/sri-service.cjs");

test("Calcula subtotal, IVA y total de la factura por línea",()=>{
  const result=buildLines({items:[
    {descripcion:"Encaje",cantidad:"2",precioUnitario:"10.00",iva:15},
    {descripcion:"Cinta",cantidad:"3",precioUnitario:"2.00",iva:0}
  ]});
  assert.equal(result.base,26);
  assert.equal(result.iva,3);
  assert.equal(result.total,29);
  assert.deepEqual(result.lines.map(x=>x.impuestos[0].codigoPorcentaje),["4","0"]);
  assert.equal(result.lines[0].precioTotalSinImpuesto,"20.00");
});
test("Rechaza precios no válidos y comprobantes sin valor",()=>{
  assert.throws(()=>buildLines({items:[{descripcion:"x",cantidad:"1",precioUnitario:"0",iva:0}]}));
});
test("Valida datos imprescindibles y archivo de firma",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"nicole-test-"));
  try{
    const file=path.join(dir,"demo.p12");fs.writeFileSync(file,"solo test");
    const cfg={ruc:"1790012345001",razonSocial:"Negocio",direccionMatriz:"Quito",p12Path:file};
    const order={p12Password:"solo-test",cliente:{tipo:"cedula",identificacion:"1710034065",razonSocial:"Cliente"},
      items:[{descripcion:"Encaje",cantidad:"1",precioUnitario:"8",iva:15}]};
    assert.doesNotThrow(()=>validateOrder(order,cfg));
    assert.throws(()=>validateOrder({...order,p12Password:""},cfg));
    assert.throws(()=>validateOrder({...order,items:[{...order.items[0],iva:12}]},cfg));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
test("El historial resiste reinicios y no permite repetir secuenciales",()=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"nicole-ledger-"));
  try{
    const store=new DiskStore(dir);
    store.saveConfig({ruc:"1790012345001",razonSocial:"Negocio",direccionMatriz:"Quito",ambiente:"pruebas",
      estab:"001",ptoEmi:"001",nextSeq:2000});
    const r={id:"00000000-0000-4000-8000-000000000001",ruc:"1790012345001",estab:"001",ptoEmi:"001",seq:2000,
      claveAcceso:"0101202601179001234500110010010000020001234567811",estado:"PREPARADA"};
    store.reserve(r);
    const next=new DiskStore(dir);
    assert.equal(next.config().nextSeq,2001);
    assert.equal(next.list().length,1);
    assert.throws(()=>next.reserve({...r,id:"00000000-0000-4000-8000-000000000002",claveAcceso:"otraClave"}));
    assert.throws(()=>next.saveConfig({...next.config(),nextSeq:2000}));
  }finally{fs.rmSync(dir,{recursive:true,force:true});}
});

test("Interpreta respuestas de autorización reales del SDK",()=>{
  assert.equal(normalizeStatus({autorizaciones:[{estado:"AUTORIZADO"}]}),"AUTORIZADO");
  assert.equal(normalizeStatus({autorizaciones:[{estado:"NO AUTORIZADO"}]}),"NO_AUTORIZADO");
  assert.equal(normalizeStatus({autorizaciones:[]}),"PENDIENTE");
  assert.equal(normalizeStatus({estado:"DEVUELTA"}),"DEVUELTA");
});
