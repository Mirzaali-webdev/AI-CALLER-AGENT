'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const DATA_FILE = path.join(__dirname, 'data', 'compliance.json');
const SESSION_COOKIE = 'rocketize_session';
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const sessions = new Map();
const loginAttempts = new Map();
let state = { optOuts: [], callAttempts: [] };
let writes = Promise.resolve();

// The browser app is embedded here so this is the only application source file.
const PAGE = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#111827">
<title>Rocketize Caller Desk</title>
<style>
:root{color-scheme:light;--ink:#172033;--muted:#667085;--purple:#6545e8;--pale:#f4f1ff;--border:#e7e9ef;--bg:#f7f8fb}*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Arial,sans-serif;font-size:15px;line-height:1.55}button,input,select,textarea{font:inherit}.topbar{min-height:70px;background:#fff;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;padding:12px max(5vw,24px);gap:16px}.brand{color:var(--ink);font-size:20px;font-weight:800;text-decoration:none}.status{color:var(--muted);font-size:12px}main{max-width:1080px;margin:auto;padding:42px 22px}.intro{margin-bottom:24px}.eyebrow{font-size:10px;font-weight:700;letter-spacing:1.5px;color:var(--purple)}h1{font-size:40px;line-height:1.15;margin:8px 0}h1 span{color:var(--purple)}.muted{color:var(--muted)}.notice{background:#fff8e8;border:1px solid #f1d99c;border-radius:10px;padding:13px 16px;color:#654c18;font-size:13px;margin:20px 0}.layout{display:grid;grid-template-columns:1.1fr .9fr;gap:18px;align-items:start}.column{display:grid;gap:18px}.panel{background:#fff;border:1px solid var(--border);border-radius:14px;padding:22px;box-shadow:0 4px 18px #1a1f3308}.panel h2{font-size:20px;margin:0 0 16px}.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}form{display:grid;gap:13px}label{font-size:12px;font-weight:600;color:#394256;display:grid;gap:6px}input:not([type=checkbox]),select,textarea{width:100%;border:1px solid #dfe2e9;border-radius:8px;background:white;color:var(--ink);padding:10px 11px;min-height:41px;font-size:13px}textarea{resize:vertical}.checks{display:grid;grid-template-columns:1fr 1fr;gap:8px}.check,.consent{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:400}.consent{align-items:flex-start;background:#f8f8fb;padding:11px;border-radius:8px}.consent input,.check input{accent-color:var(--purple);margin:2px 0 0}.actions{display:flex;gap:9px;flex-wrap:wrap}.button{border:0;border-radius:8px;padding:10px 14px;font-size:12px;font-weight:700;cursor:pointer}.primary{background:var(--purple);color:#fff}.primary:disabled{background:#c7c2da;cursor:not-allowed}.secondary{background:#f0edff;color:#573bd0}.text-button{border:0;background:transparent;color:var(--purple);font-size:12px;font-weight:700;cursor:pointer}.script{background:#faf9ff;border:1px solid #ece8ff;border-radius:9px;padding:13px;max-height:390px;overflow:auto}.script p{font-size:12px;color:#475064;margin:0 0 12px}.script strong{display:block;color:#252b3b}.records{display:grid;gap:8px}.record{border:1px solid var(--border);border-radius:8px;padding:10px;font-size:12px}.record small{display:block;color:var(--muted)}.hint{font-size:11px;color:#8790a0;margin:0}footer{text-align:center;color:#8b92a0;font-size:10px;padding:0 20px 24px}.toast{position:fixed;bottom:20px;left:50%;transform:translate(-50%,12px);opacity:0;pointer-events:none;background:#20263a;color:#fff;border-radius:8px;padding:10px 15px;font-size:12px;transition:.2s}.toast.visible{opacity:1;transform:translate(-50%,0)}dialog{border:1px solid var(--border);border-radius:12px;padding:24px;max-width:380px;width:calc(100% - 32px)}dialog::backdrop{background:#11182788}@media(max-width:760px){.layout{grid-template-columns:1fr}}@media(max-width:520px){main{padding:30px 14px}.panel{padding:17px}.form-grid{grid-template-columns:1fr}.checks{grid-template-columns:1fr 1fr}h1{font-size:34px}}
</style>
</head>
<body>
<header class="topbar"><a class="brand" href="#main">🚀 rocketize <span class="status">CALLER DESK</span></a><div><span class="status">AI calling · consent required</span> <button class="text-button" id="authButton" type="button">Operator sign in</button></div></header>
<main id="main"><section class="intro"><p class="eyebrow">OUTREACH WORKSPACE</p><h1>Helpful conversations.<br><span>No hard selling.</span></h1><p class="muted">Prepare an introduction, record lead preferences, and place an AI-assisted call only when appropriate consent is confirmed.</p></section>
<div class="notice"><strong>Before calling:</strong> Configure your Vapi account and approved calling number. Only call people who have given appropriate consent; respect opt-outs and local laws. Calls are initiated by an operator.</div>
<div class="layout"><section class="panel"><h2>Contact details</h2><form id="leadForm"><div class="form-grid"><label>Person's name<input id="personName" placeholder="e.g. Asha"></label><label>Business name<input id="businessName" placeholder="e.g. Green Leaf Cafe"></label></div><div class="form-grid"><label>Business type<input id="businessType" placeholder="e.g. Restaurant"></label><label>Phone number<input id="phone" type="tel" placeholder="+15551234567 (country code required)" required></label></div><label>Current website<input id="website" type="url" placeholder="https://example.com"></label><fieldset style="border:0;padding:0;margin:0"><legend style="font-size:12px;font-weight:600;margin-bottom:8px">What might they need?</legend><div class="checks"><label class="check"><input type="checkbox" name="service" value="Website design/development">Website design</label><label class="check"><input type="checkbox" name="service" value="E-commerce website">E-commerce</label><label class="check"><input type="checkbox" name="service" value="Website redesign">Redesign</label><label class="check"><input type="checkbox" name="service" value="Performance marketing / ads">Ads &amp; marketing</label><label class="check"><input type="checkbox" name="service" value="Lead generation">Lead generation</label><label class="check"><input type="checkbox" name="service" value="Social media management">Social media</label></div></fieldset><label>Call outcome<select id="leadStatus"><option value="CALLBACK">Callback requested</option><option value="INTERESTED">Interested</option><option value="QUALIFIED">Qualified</option><option value="NOT_INTERESTED">Not interested</option><option value="WRONG_NUMBER">Wrong number</option><option value="NO_ANSWER">No answer</option></select></label><div class="form-grid"><label>Preferred callback<input id="callback" placeholder="e.g. Thursday afternoon"></label><label>Preferred contact<select id="contactMethod"><option value="">Choose one</option><option>Phone call</option><option>WhatsApp</option><option>Email</option></select></label></div><label>Notes<textarea id="summary" rows="3" placeholder="Needs, questions, and useful context"></textarea></label><div class="consent"><input id="permission" type="checkbox"><span>I confirm this person agreed to receive this call and applicable consent/DND requirements have been checked.</span></div><div class="consent" style="color:#a13939"><input id="optOut" type="checkbox"><span>This person asked not to be contacted again. Record the opt-out and do not call.</span></div><div class="actions"><button class="button primary" id="callButton" type="button" disabled>Start AI call</button><button class="button secondary" id="saveButton" type="button">Save lead</button></div><p class="hint" id="callHint">Sign in, then confirm consent. Opt-outs always disable calling.</p></form></section>
<aside class="column"><section class="panel"><h2>Conversation guide</h2><p class="hint">Use as a natural guide—not word for word.</p><div class="script" id="scriptContent" aria-live="polite"></div><button class="button secondary" id="copyScript" type="button" style="margin-top:12px">Copy conversation guide</button></section><section class="panel"><h2>Lead records <button class="text-button" id="exportButton" type="button">Export JSON</button></h2><p class="hint">Lead details are stored in this browser. Server opt-out and call audit records are stored by the backend.</p><div class="records" id="recordsList"></div></section></aside></div></main>
<footer>Rocketize Caller Desk · Be transparent, respect opt-outs, and never promise unverified results.</footer><dialog id="authDialog"><form id="authForm"><h2>Operator sign in</h2><p class="hint">Enter the backend operator password. It is sent only to this site's backend.</p><label>Operator password<input id="operatorPassword" type="password" autocomplete="current-password" required></label><p id="authError" class="hint" role="alert"></p><div class="actions"><button class="button primary" type="submit">Sign in</button><button class="button secondary" id="cancelAuth" type="button">Cancel</button></div></form></dialog><div id="toast" class="toast" role="status" aria-live="polite"></div>
<script>
'use strict';
var $ = function(id){return document.getElementById(id);};
var STORAGE_KEY='rocketize-caller-leads-v1';
var optOutNumbers=new Set();
var operatorSignedIn=false;
function readRecords(){try{var data=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]');return Array.isArray(data)?data:[];}catch(e){return [];}}
function toast(message){var el=$('toast');el.textContent=message;el.classList.add('visible');clearTimeout(toast.timer);toast.timer=setTimeout(function(){el.classList.remove('visible');},2600);}
function services(){return Array.prototype.map.call(document.querySelectorAll('input[name="service"]:checked'),function(input){return input.value;});}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function makeScript(){var name=$('personName').value.trim()||'[Name]';var business=$('businessName').value.trim()||'[Business name]';var kind=$('businessType').value.trim();var audience=kind?'businesses like yours in '+kind:'businesses';var selected=services();var need=selected.length?' You may be interested in '+selected.join(', ')+'.':'';return [['OPENING','Hello, am I speaking with '+name+' from '+business+'?'],['INTRODUCTION','Hi, I’m the AI calling assistant from Rocketize. We help '+audience+' improve their online presence through websites and digital marketing. Is this a good time for a quick conversation?'],['IF THEY ARE BUSY','No problem. Would you prefer a callback at another time? If not, thank you for your time.'],['DISCOVERY','Does your business currently have a website? Are you happy with it, or considering improvements?'],['UNDERSTAND THE NEED','What are you mainly looking to improve—your online presence, getting more customers, or generating leads?'+need],['NEXT STEP','If interested, ask the best time and preferred contact method. Do not imply a booking is confirmed.'],['COMMON QUESTIONS','Pricing depends on requirements. Never promise specific results.'],['CLOSE','Thank them for their time and respect any request not to be contacted again.']];}
function renderScript(){var lines=makeScript();$('scriptContent').innerHTML=lines.map(function(line){return '<p><strong>'+escapeHtml(line[0])+'</strong>'+escapeHtml(line[1])+'</p>';}).join('');return lines.map(function(line){return line[0]+': '+line[1];}).join('\n\n');}
function phone(){return $('phone').value.trim().replace(/[^\d+]/g,'');}
function refreshCall(){var number=phone();var opted=$('optOut').checked||optOutNumbers.has(number);var valid=/^\+[1-9]\d{7,14}$/.test(number);$('callButton').disabled=!operatorSignedIn||!$('permission').checked||opted||!valid;if(opted)$('callHint').textContent='This number is marked as opted out. Calling is disabled.';else if(!operatorSignedIn)$('callHint').textContent='Operator sign-in is required before placing a call.';else if(!$('permission').checked)$('callHint').textContent='Confirm permission before an AI call can be placed.';else if(!valid)$('callHint').textContent='Enter a valid international number beginning with + and its country code.';else $('callHint').textContent='The backend will place an AI-assisted call using your configured voice provider.';}
function collectLead(){return {lead_status:$('leadStatus').value,business_name:$('businessName').value.trim(),person_name:$('personName').value.trim(),business_type:$('businessType').value.trim(),website:$('website').value.trim(),phone:phone(),service_interest:services(),preferred_callback:$('callback').value.trim(),preferred_contact_method:$('contactMethod').value,summary:$('summary').value.trim(),consent_confirmed:$('permission').checked,do_not_contact:$('optOut').checked,next_action:$('optOut').checked?'Do not contact; respect opt-out':$('leadStatus').value==='CALLBACK'?'Callback requested':$('leadStatus').value,updated_at:new Date().toISOString()};}
function renderRecords(){var records=readRecords();$('recordsList').innerHTML=records.length?records.slice().reverse().map(function(record){var title=record.business_name||record.person_name||record.phone||'Unnamed lead';var detail=[record.person_name,record.phone].filter(Boolean).join(' · ');var status=record.do_not_contact?'DO NOT CONTACT':record.lead_status||'SAVED';return '<div class="record"><strong>'+escapeHtml(title)+'</strong><small>'+escapeHtml(detail)+'</small><small>'+escapeHtml(status)+'</small></div>';}).join(''):'<p class="hint">No saved leads yet.</p>';}
async function saveLead(){var record=collectLead();if(!record.phone){$('phone').focus();toast('Enter a phone number to save this lead.');return;}var records=readRecords();records.push(record);try{localStorage.setItem(STORAGE_KEY,JSON.stringify(records));}catch(e){toast('Could not save in this browser.');return;}if(record.do_not_contact){optOutNumbers.add(record.phone);try{await fetch('/api/opt-outs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:record.phone})});}catch(e){}}renderRecords();refreshCall();toast(record.do_not_contact?'Opt-out saved; backend sync attempted.':'Lead saved in this browser.');}
$('leadForm').addEventListener('submit',function(event){event.preventDefault();});
$('leadForm').addEventListener('input',function(){renderScript();refreshCall();});
$('leadForm').addEventListener('change',function(){renderScript();refreshCall();});
$('saveButton').addEventListener('click',saveLead);
$('callButton').addEventListener('click',async function(){var number=phone();if(!number||!$('permission').checked||$('optOut').checked||optOutNumbers.has(number)||!operatorSignedIn){refreshCall();return;}var button=$('callButton');button.disabled=true;button.textContent='Starting call…';try{var response=await fetch('/api/calls',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({phone:number,name:$('personName').value.trim(),consentConfirmed:$('permission').checked,doNotContact:$('optOut').checked})});var result=await response.json();if(!response.ok)throw new Error(result.error||'Could not start the call.');toast('AI call started. Call ID: '+result.callId);}catch(error){toast(error.message||'Backend unavailable.');}finally{button.textContent='Start AI call';refreshCall();}});
function setSignedIn(value){operatorSignedIn=value;$('authButton').textContent=value?'Sign out':'Operator sign in';refreshCall();}
$('authButton').addEventListener('click',async function(){if(!operatorSignedIn){$('authError').textContent='';$('authDialog').showModal();$('operatorPassword').focus();return;}try{await fetch('/api/logout',{method:'POST'});}finally{setSignedIn(false);toast('Signed out.');}});
$('cancelAuth').addEventListener('click',function(){$('authDialog').close();});
$('authForm').addEventListener('submit',async function(event){event.preventDefault();$('authError').textContent='';try{var response=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:$('operatorPassword').value})});var result=await response.json();if(!response.ok)throw new Error(result.error||'Sign-in failed.');$('operatorPassword').value='';$('authDialog').close();setSignedIn(true);toast('Operator signed in.');}catch(error){$('authError').textContent=error.message||'Backend unavailable.';}});
fetch('/api/session').then(function(response){return response.json();}).then(function(result){setSignedIn(result.authenticated);}).catch(function(){setSignedIn(false);});
$('copyScript').addEventListener('click',async function(){try{await navigator.clipboard.writeText(renderScript());toast('Conversation guide copied.');}catch(e){toast('Clipboard unavailable.');}});
$('exportButton').addEventListener('click',function(){var records=readRecords();if(!records.length){toast('There are no lead records to export.');return;}var blob=new Blob([JSON.stringify(records,null,2)],{type:'application/json'});var url=URL.createObjectURL(blob);var link=document.createElement('a');link.href=url;link.download='rocketize-leads.json';link.click();URL.revokeObjectURL(url);toast('Lead records exported.');});
readRecords().filter(function(record){return record.do_not_contact&&record.phone;}).forEach(function(record){optOutNumbers.add(record.phone);});renderScript();renderRecords();refreshCall();
</script></body></html>`;

function sendJson(response, status, body, extraHeaders = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  });
  response.end(JSON.stringify(body));
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const index = part.indexOf('=');
    if (index < 0) return ['', ''];
    return [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
}

function readSession(request) {
  const token = parseCookies(request.headers.cookie)[SESSION_COOKIE];
  const session = token && sessions.get(token);
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }
  session.expiresAt = Date.now() + SESSION_TTL_MS;
  return { token, session };
}

function requireSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === request.headers.host;
  } catch {
    return false;
  }
}

async function readJson(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > 16_384) throw new Error('Request body is too large.');
  }
  try {
    return JSON.parse(raw || '{}');
  } catch {
    throw new Error('Invalid JSON request.');
  }
}

function normalizePhone(value) {
  const phone = String(value || '').trim();
  return /^\+[1-9]\d{7,14}$/.test(phone) ? phone : null;
}

function persistState() {
  writes = writes.then(async () => {
    await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
    const temporary = `${DATA_FILE}.${process.pid}.tmp`;
    await fs.writeFile(temporary, JSON.stringify(state, null, 2), { mode: 0o600 });
    await fs.rename(temporary, DATA_FILE);
  });
  return writes;
}

function requestLimit(sessionToken) {
  const now = Date.now();
  const recent = (sessions.get(sessionToken)?.calls || []).filter((time) => now - time < 60_000);
  if (recent.length >= 5) return false;
  const session = sessions.get(sessionToken);
  if (session) session.calls = [...recent, now];
  return true;
}

async function route(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  const secureCookie = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('X-Frame-Options', 'DENY');

  if (request.method === 'GET' && url.pathname === '/api/session') {
    return sendJson(response, 200, { authenticated: Boolean(readSession(request)) });
  }
  if (request.method === 'POST' && !requireSameOrigin(request)) {
    return sendJson(response, 403, { error: 'Cross-origin request rejected.' });
  }
  if (request.method === 'POST' && url.pathname === '/api/login') {
    const ip = request.socket.remoteAddress || 'unknown';
    const attempts = loginAttempts.get(ip) || { count: 0, until: 0 };
    if (attempts.until > Date.now() && attempts.count >= 8) return sendJson(response, 429, { error: 'Too many sign-in attempts. Try again later.' });
    const password = process.env.APP_PASSWORD || '';
    if (password.length < 16) return sendJson(response, 503, { error: 'Backend operator password is not configured securely.' });
    const body = await readJson(request);
    const supplied = Buffer.from(String(body.password || ''));
    const expected = Buffer.from(password);
    const valid = supplied.length === expected.length && crypto.timingSafeEqual(supplied, expected);
    if (!valid) {
      const next = attempts.until > Date.now() ? attempts : { count: 0, until: Date.now() + 15 * 60_000 };
      next.count += 1;
      loginAttempts.set(ip, next);
      return sendJson(response, 401, { error: 'Incorrect password.' });
    }
    loginAttempts.delete(ip);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS, calls: [] });
    return sendJson(response, 200, { authenticated: true }, { 'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL_MS / 1000}${secureCookie}` });
  }
  if (request.method === 'POST' && url.pathname === '/api/logout') {
    const session = readSession(request);
    if (session) sessions.delete(session.token);
    return sendJson(response, 200, { authenticated: false }, { 'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${secureCookie}` });
  }
  if (request.method === 'POST' && url.pathname === '/api/opt-outs') {
    const body = await readJson(request);
    const phone = normalizePhone(body.phone);
    if (!phone) return sendJson(response, 400, { error: 'Use a valid international number with country code (E.164).' });
    if (!state.optOuts.includes(phone)) { state.optOuts.push(phone); await persistState(); }
    return sendJson(response, 200, { saved: true });
  }
  if (request.method === 'POST' && url.pathname === '/api/calls') {
    const auth = readSession(request);
    if (!auth) return sendJson(response, 401, { error: 'Operator sign-in required.' });
    if (!requestLimit(auth.token)) return sendJson(response, 429, { error: 'Call limit reached. Wait one minute before another call.' });
    const body = await readJson(request);
    const phone = normalizePhone(body.phone);
    const name = String(body.name || '').trim().slice(0, 100);
    if (!phone) return sendJson(response, 400, { error: 'Use a valid international number with country code (E.164).' });
    if (body.consentConfirmed !== true || body.doNotContact === true) return sendJson(response, 403, { error: 'Confirmed consent is required, and opted-out numbers cannot be called.' });
    if (state.optOuts.includes(phone)) return sendJson(response, 403, { error: 'This number is on the server do-not-contact list.' });
    const apiKey = process.env.VAPI_PRIVATE_KEY;
    const assistantId = process.env.VAPI_ASSISTANT_ID;
    const phoneNumberId = process.env.VAPI_PHONE_NUMBER_ID;
    if (!apiKey || !assistantId || !phoneNumberId) return sendJson(response, 503, { error: 'Voice provider is not fully configured on the backend.' });
    const attempt = { phone, name, requestedAt: new Date().toISOString(), consentConfirmed: true, consentConfirmedAt: new Date().toISOString(), status: 'requested' };
    state.callAttempts.push(attempt);
    await persistState();
    try {
      const providerResponse = await fetch('https://api.vapi.ai/call/phone', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ assistantId, phoneNumberId, customer: { number: phone, ...(name ? { name } : {}) } })
      });
      const result = await providerResponse.json().catch(() => ({}));
      if (!providerResponse.ok) {
        attempt.status = 'provider_error';
        await persistState();
        console.error('Voice provider rejected a call request:', providerResponse.status);
        return sendJson(response, 502, { error: 'Voice provider could not start the call. Check backend configuration.' });
      }
      attempt.status = 'started';
      attempt.providerCallId = String(result.id || '');
      await persistState();
      return sendJson(response, 200, { callId: attempt.providerCallId || 'accepted', status: attempt.status });
    } catch (error) {
      attempt.status = 'provider_error';
      await persistState();
      console.error('Voice provider request failed:', error.message);
      return sendJson(response, 502, { error: 'Could not reach the voice provider.' });
    }
  }
  if (request.method === 'GET' && url.pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    return response.end(PAGE);
  }
  return sendJson(response, 404, { error: 'Not found.' });
}

async function start() {
  try {
    const stored = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
    if (Array.isArray(stored.optOuts)) state.optOuts = stored.optOuts;
    if (Array.isArray(stored.callAttempts)) state.callAttempts = stored.callAttempts;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const server = http.createServer((request, response) => {
    route(request, response).catch((error) => {
      console.error('Request failed:', error.message);
      if (!response.headersSent) sendJson(response, 400, { error: error.message || 'Request failed.' });
      else response.destroy();
    });
  });
  server.listen(PORT, HOST, () => console.log(`Rocketize Caller Desk listening on ${HOST}:${PORT}`));
}

start().catch((error) => {
  console.error('Could not start backend:', error.message);
  process.exitCode = 1;
});
