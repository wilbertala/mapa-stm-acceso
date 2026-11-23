/** Verificaciones para Cloudflare Workers, sin secretos en código. */
const JWKS_URL='https://www.googleapis.com/oauth2/v3/certs';
let jwksCache={expires:0,keys:[]};
const encoder=new TextEncoder();

function b64url(value){
 if(typeof value!=='string'||!/^[A-Za-z0-9_-]+$/.test(value))throw Error('BASE64URL_INCORRECTO');
 const padded=value.replace(/-/g,'+').replace(/_/g,'/')+'='.repeat((4-value.length%4)%4);
 return Uint8Array.from(atob(padded),c=>c.charCodeAt(0));
}
function decodedJSON(data){return JSON.parse(new TextDecoder().decode(b64url(data)));}
function exactAllowlist(email,raw){
 const set=String(raw||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
 return set.length>0&&set.includes(String(email||'').trim().toLowerCase());
}
async function googleKeys(fetcher){
 if(jwksCache.expires>Date.now()&&jwksCache.keys.length)return jwksCache.keys;
 const response=await fetcher(JWKS_URL,{headers:{Accept:'application/json'},redirect:'error'});
 if(!response.ok)throw Error('JWKS_NO_DISPONIBLES');
 const parsed=await response.json();
 if(!Array.isArray(parsed.keys)||parsed.keys.length===0)throw Error('JWKS_INVALIDAS');
 const cc=response.headers.get('cache-control')||'';
 const age=Number((/max-age=(\d+)/.exec(cc)||[])[1]);
 const ttl=Math.max(60,Math.min(900,Number.isFinite(age)?age:300));
 jwksCache={expires:Date.now()+ttl*1000,keys:parsed.keys.filter(k=>k.kty==='RSA'&&k.alg==='RS256')};
 return jwksCache.keys;
}
export async function verifyGoogleIdToken(token,env,{fetcher=fetch,now=Math.floor(Date.now()/1000),keys=null}={}){
 if(typeof token!=='string'||token.length>6500||token.length<60)return false;
 if(!env.GOOGLE_CLIENT_ID||!env.ADMIN_EMAILS||env.GOOGLE_CLIENT_ID.includes('CONFIGURAR'))return false;
 try{
  const parts=token.split('.');if(parts.length!==3)return false;
  const header=decodedJSON(parts[0]);const payload=decodedJSON(parts[1]);
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>256)return false;
  if(!['https://accounts.google.com','accounts.google.com'].includes(payload.iss))return false;
  if(payload.aud!==env.GOOGLE_CLIENT_ID||!payload.sub||typeof payload.sub!=='string')return false;
  if(typeof payload.exp!=='number'||typeof payload.iat!=='number'||payload.exp<=now||payload.iat>now+120||payload.exp-payload.iat>9000)return false;
  if(payload.email_verified!==true&&! (payload.email_verified==='true'))return false;
  if(!exactAllowlist(payload.email,env.ADMIN_EMAILS))return false;
  const list=keys||await googleKeys(fetcher);
  const jwk=list.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use==='sig');if(!jwk)return false;
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  return await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),encoder.encode(parts[0]+'.'+parts[1]));
 }catch{return false;}
}
function validHex64(s){return typeof s==='string'&&/^[0-9a-f]{64}$/i.test(s);}
export async function verifyInvitation(token,expectedHash){
 if(!validHex64(token)||!validHex64(expectedHash))return false;
 const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(token)));
 const expected=Uint8Array.from(expectedHash.match(/../g),h=>parseInt(h,16));
 let diff=0;for(let i=0;i<32;i++)diff|=digest[i]^expected[i];return diff===0;
}
export async function authorize(request,env,deps={}){
 const bearer=request.headers.get('authorization')||'';
 if(/^Bearer [^\s]+$/i.test(bearer)){
  if(await verifyGoogleIdToken(bearer.slice(7),env,deps))return 'admin';
 }
 const guest=request.headers.get('x-stm-invite')||'';
 return await verifyInvitation(guest,env.STM_INVITE_SHA256)?'guest':null;
}
export function corsHeaders(request,env){
 const origin=request.headers.get('origin');
 const allowed=String(env.FRONTEND_ORIGIN||'').replace(/\/$/,'');
 if(origin!==allowed||!origin)return null;
 return {'Access-Control-Allow-Origin':allowed,'Access-Control-Allow-Methods':'GET, OPTIONS',
 'Access-Control-Allow-Headers':'authorization,x-stm-invite',
 'Access-Control-Max-Age':'600','Vary':'Origin'};
}
