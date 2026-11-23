import approvedHashes from './approved-hashes.json' with {type:'json'};
/** Google Drive COPSA — lectura exclusiva mediante cuenta de servicio (sin claves en frontend). */
const encoder=new TextEncoder();
const SCOPES='https://www.googleapis.com/auth/drive.readonly';
const AUD='https://oauth2.googleapis.com/token';
const MAX_DOWNLOAD=19*1024*1024,MAX_EXPANDED=30*1024*1024;
const KNOWN=new Set([
 'recorridos_indice_v09.json','RECONSTRUCCION_CANELONES_V023_R11.json','paradas_stm_indice.json.gz',
 ...Array.from({length:16},(_,i)=>`geometrias_mtop_v017_${String(i).padStart(2,'0')}.json.gz`)
]);
let accessCache={token:null,expires:0};
const fileCache=new Map();
function b64url(bytes){return btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');}
function asB64(data){return b64url(encoder.encode(data));}
function pemBytes(pem){
 const raw=String(pem||'').replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g,'');
 if(!/^[A-Za-z0-9+/=]{400,}$/.test(raw))throw Error('CLAVE_DE_SERVICIO_INVALIDA');
 return Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
}
export async function serviceJwt(env,now=Math.floor(Date.now()/1000)){
 let credentials;
 try{credentials=JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON||'');}catch{throw Error('SERVICIO_SIN_CREDENCIALES');}
 if(!credentials.client_email?.endsWith('.gserviceaccount.com')||!credentials.private_key)throw Error('IDENTIDAD_DE_SERVICIO_INVALIDA');
 const header=asB64(JSON.stringify({alg:'RS256',typ:'JWT'}));
 const payload=asB64(JSON.stringify({iss:credentials.client_email,scope:SCOPES,aud:AUD,iat:now,exp:now+3600}));
 const data=`${header}.${payload}`;
 const key=await crypto.subtle.importKey('pkcs8',pemBytes(credentials.private_key),{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['sign']);
 return data+'.'+b64url(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5',key,encoder.encode(data))));
}
export async function driveAccessToken(env,{fetcher=fetch,now=Date.now()}={}){
 if(accessCache.token&&accessCache.expires>now+120000)return accessCache.token;
 const jwt=await serviceJwt(env,Math.floor(now/1000));
 const response=await fetcher(AUD,{method:'POST',body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion:jwt}),redirect:'error'});
 if(!response.ok)throw Error('GOOGLE_SERVICIO_SIN_AUTORIZACION');
 const value=await response.json();
 if(typeof value.access_token!=='string'||!value.access_token)throw Error('GOOGLE_TOKEN_INVALIDO');
 accessCache={token:value.access_token,expires:now+Math.min(3300,Math.max(60,Number(value.expires_in)||3600))*1000};
 return value.access_token;
}
async function readLimited(response,limit){
 if(!response.ok)throw Error('DRIVE_SIN_ACCESO');
 const len=Number(response.headers.get('content-length')||0);if(len>limit)throw Error('DRIVE_ARCHIVO_DEMASIADO_GRANDE');
 const reader=response.body?.getReader();if(!reader)throw Error('DRIVE_CUERPO_INVALIDO');
 const chunks=[];let total=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>limit)throw Error('LIMITE_TAMANO');chunks.push(value);}}
 finally{try{reader.releaseLock()}catch{}}
 const out=new Uint8Array(total);let offset=0;for(const chunk of chunks){out.set(chunk,offset);offset+=chunk.length;}return out;
}
export async function verifyApprovedFile(name,bytes){
 const expected=approvedHashes[name];
 if(!expected||!/^[0-9a-f]{64}$/.test(expected))throw Error('FUENTE_SIN_HUELLA_APROBADA');
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 if(sha!==expected)throw Error('FUENTE_MODIFICADA_SIN_AUTORIZACION');
 return true;
}
async function unpack(data,compressed){
 if(!compressed)return new TextDecoder().decode(data);
 const stream=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
 const decoded=await readLimited(new Response(stream),MAX_EXPANDED);
 return new TextDecoder().decode(decoded);
}
export async function loadDriveJson(env,name,{fetcher=fetch,now=Date.now()}={}){
 if(!KNOWN.has(name))throw Error('ARCHIVO_NO_PERMITIDO');
 const cached=fileCache.get(name);if(cached?.expires>now)return cached.value;
 if(!/^[A-Za-z0-9_-]{20,}$/.test(env.DRIVE_FOLDER_ID||''))throw Error('CARPETA_NO_CONFIGURADA');
 const access=await driveAccessToken(env,{fetcher,now});
 const q=`'${env.DRIVE_FOLDER_ID}' in parents and name = '${name}' and trashed = false`;
 const url='https://www.googleapis.com/drive/v3/files?'+new URLSearchParams({q,fields:'nextPageToken,files(id,name,mimeType,size,parents)',pageSize:'10'});
 const headers={Authorization:`Bearer ${access}`};
 const listing=await fetcher(url,{headers,redirect:'error'});
 if(!listing.ok)throw Error('DRIVE_NO_PERMITE_LISTAR');
 const list=await listing.json();
 if(list.nextPageToken||!Array.isArray(list.files)||list.files.length!==1)throw Error('DRIVE_ARCHIVO_FALTANTE_O_DUPLICADO');
 const f=list.files[0];
 if(f.name!==name||!f.parents?.includes(env.DRIVE_FOLDER_ID)||!/^[-\w]{15,}$/.test(f.id)||!['application/json','application/octet-stream','application/gzip'].includes(f.mimeType))throw Error('DRIVE_ARCHIVO_NO_COINCIDE');
 if(Number(f.size)>MAX_DOWNLOAD)throw Error('DRIVE_EXCESO_TAMANO');
 const body=await fetcher(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(f.id)}?alt=media`,{headers,redirect:'error'});
 const bytes=await readLimited(body,MAX_DOWNLOAD);
 await verifyApprovedFile(name,bytes);
 const text=await unpack(bytes,name.endsWith('.gz'));
 let value;try{value=JSON.parse(text);}catch{throw Error('DRIVE_JSON_CORRUPTO');}
 fileCache.set(name,{expires:now+120000,value});return value;
}
