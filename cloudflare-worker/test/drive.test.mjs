import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,createVerify} from 'node:crypto';
import {serviceJwt,loadDriveJson,verifyApprovedFile} from '../src/drive.mjs';
test('Drive rechaza nombres fuera de la lista cerrada',async()=>{
 await assert.rejects(loadDriveJson({DRIVE_FOLDER_ID:'carpeta'},'../secrets.json'),/ARCHIVO_NO_PERMITIDO/);
});
test('JWT de servicio firma RS256 sin exponer la clave',async()=>{
 const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
 const data={client_email:'stm-reader@stm-pruebas.iam.gserviceaccount.com',private_key:privateKey.export({format:'pem',type:'pkcs8'}).toString()};
 const jwt=await serviceJwt({GOOGLE_SERVICE_ACCOUNT_JSON:JSON.stringify(data)},1700000000);
 const parts=jwt.split('.');assert.equal(parts.length,3);
 const payload=JSON.parse(Buffer.from(parts[1],'base64url').toString());
 assert.equal(payload.scope,'https://www.googleapis.com/auth/drive.readonly');
 assert.equal(payload.aud,'https://oauth2.googleapis.com/token');
 const verify=createVerify('RSA-SHA256');verify.update(parts[0]+'.'+parts[1]);
 assert.ok(verify.verify(publicKey,Buffer.from(parts[2],'base64url')));
});

test('Drive rechaza archivos modificados aunque conserven el nombre',async()=>{
 const bytes=new TextEncoder().encode('datos manipulados');
 await assert.rejects(verifyApprovedFile('recorridos_indice_v09.json',bytes),/FUENTE_MODIFICADA_SIN_AUTORIZACION/);
});
