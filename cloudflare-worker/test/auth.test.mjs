import test from 'node:test';import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,sign as nodeSign} from 'node:crypto';
import {verifyInvitation,verifyGoogleIdToken,authorize,corsHeaders} from '../src/auth.mjs';
const b=s=>Buffer.from(JSON.stringify(s)).toString('base64url');
const email='operador.admin@example.com';
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'});Object.assign(jwk,{kid:'clave-prueba',use:'sig',alg:'RS256'});
function token(payload={}){
 const now=Math.floor(Date.now()/1000);
 const header=b({alg:'RS256',kid:'clave-prueba',typ:'JWT'});
 const data=b({iss:'https://accounts.google.com',aud:'client-test',sub:'U123',email,email_verified:true,iat:now-10,exp:now+3600,...payload});
 const signed=header+'.'+data;
 return signed+'.'+nodeSign('RSA-SHA256',Buffer.from(signed),privateKey).toString('base64url');
}
const env={GOOGLE_CLIENT_ID:'client-test',ADMIN_EMAILS:email};
const options={keys:[jwk]};
test('GOOGLE ID token firmado: valida identidad y firma',async()=>{
 assert.equal(await verifyGoogleIdToken(token(),env,options),true);
 assert.equal(await verifyGoogleIdToken(token({email:'invasor@example.com'}),env,options),false);
 assert.equal(await verifyGoogleIdToken(token({email_verified:false}),env,options),false);
 assert.equal(await verifyGoogleIdToken(token({aud:'otra-app'}),env,options),false);
 assert.equal(await verifyGoogleIdToken(token({exp:1}),env,options),false);
 const damaged=token().split('.');damaged[2]=(damaged[2][0]==='A'?'B':'A')+damaged[2].slice(1);
 assert.equal(await verifyGoogleIdToken(damaged.join('.'),env,options),false);
});
test('INVITADOS: exige token hexadecimal de 64 caracteres y hash SHA-256',async()=>{
 const t='c'.repeat(64),h=createHash('sha256').update(t).digest('hex');
 assert.equal(await verifyInvitation(t,h),true);
 assert.equal(await verifyInvitation('d'.repeat(64),h),false);
 assert.equal(await verifyInvitation('invitacion',h),false);
 assert.equal(await verifyInvitation(t,'0'.repeat(64)),false);
 assert.equal(await authorize(new Request('https://api.test/api/catalogo',{headers:{'X-STM-Invite':t}}),{STM_INVITE_SHA256:h}), 'guest');
});
test('CORS solo origen GitHub Pages declarado',()=>{
 const config={FRONTEND_ORIGIN:'https://wilbertala.github.io'};
 assert.equal(corsHeaders(new Request('https://api.test/',{headers:{Origin:'https://wilbertala.github.io'}}),config)['Access-Control-Allow-Origin'],'https://wilbertala.github.io');
 assert.equal(corsHeaders(new Request('https://api.test/',{headers:{Origin:'https://atacante.test'}}),config),null);
});
