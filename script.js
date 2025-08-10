// ======= CONFIG =======
// Replace with your deployed Apps Script Web App URL (POST endpoint)
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwLhFWjzwB2gv1MJEEOnLJgG64Sv6p6FueYEQCDKsFXsS1AkJ8QKBPlX4aIpF7GDia3/exec'; // <-- REPLACE

// If GAS_URL left as placeholder, frontend will run in MOCK mode so you can test UI without backend.
const MOCK_MODE = GAS_URL.includes('PUT_YOUR_APPS_SCRIPT_WEBAPP_URL_HERE') || !GAS_URL.startsWith('http');

function log(...args){ console.log('[Tambola]', ...args); }

// Simple helper to POST JSON (real mode)
async function postAPI(payload){
  if(MOCK_MODE) return mockAPI(payload);
  try{
    const res = await fetch(GAS_URL, {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    return await res.json();
  } catch(err){
    console.error('Network/API error', err);
    return {ok:false, error: 'Network error: '+err.message};
  }
}

// ======= Mock Backend (for local testing) =======
const _mockDB = {
  rooms: {}, // roomCode -> {roomCode, hostToken, hostName, drawn:[], dividends:[]}
  players: {}, // playerId -> {playerId, roomCode, playerName, ticket}
};
function mockAPI(payload){
  const a = payload.action;
  log('MOCK API', a, payload);
  if(a === 'createRoom'){
    const roomCode = (1000 + Math.floor(Math.random()*9000)).toString();
    const hostToken = 'MOCK-'+Math.random().toString(36).slice(2,10);
    _mockDB.rooms[roomCode] = {roomCode, hostToken, hostName: payload.hostName||'Host', drawn:[], dividends:[]};
    return Promise.resolve({ok:true, roomCode, hostToken});
  }
  if(a === 'setDividends'){
    const room = _mockDB.rooms[payload.roomCode];
    if(!room) return Promise.resolve({ok:false, error:'Room not found (mock)'});
    room.dividends = payload.dividends || [];
    return Promise.resolve({ok:true});
  }
  if(a === 'joinRoom'){
    const r = _mockDB.rooms[payload.roomCode];
    if(!r) return Promise.resolve({ok:false, error:'Room not found (mock)'});
    const playerId = 'P'+Math.random().toString(36).slice(2,10);
    const ticket = generateTicket();
    _mockDB.players[playerId] = {playerId, roomCode: payload.roomCode, playerName: payload.playerName||'Player', ticket};
    return Promise.resolve({ok:true, ticket, playerId});
  }
  if(a === 'regenerateTicket'){
    const p = _mockDB.players[payload.playerId];
    if(!p) return Promise.resolve({ok:false, error:'Player not found (mock)'});
    p.ticket = generateTicket();
    return Promise.resolve({ok:true, ticket: p.ticket});
  }
  if(a === 'drawNext'){
    const room = _mockDB.rooms[payload.roomCode];
    if(!room) return Promise.resolve({ok:false, error:'Room not found (mock)'});
    // pick number
    const pool = [];
    for(let i=1;i<=90;i++) if(!room.drawn.includes(i)) pool.push(i);
    if(pool.length === 0) return Promise.resolve({ok:false, error:'All drawn'});
    const next = pool[Math.floor(Math.random()*pool.length)];
    room.drawn.push(next);
    // simple winner check (mock) omitted
    return Promise.resolve({ok:true, number: next, drawn: room.drawn, winnersFound: 0, newWinners: []});
  }
  if(a === 'getRoom'){
    const room = _mockDB.rooms[payload.roomCode];
    if(!room) return Promise.resolve({ok:false, error:'Room not found (mock)'});
    const players = Object.values(_mockDB.players).filter(p=> p.roomCode === payload.roomCode).map(p=> ({PlayerId:p.playerId, PlayerName:p.playerName, Ticket: p.ticket}));
    return Promise.resolve({ok:true, room: {...room, Drawn: room.drawn }, players, dividends: room.dividends, claims: []});
  }
  return Promise.resolve({ok:false, error:'unknown action (mock)'});
}

// ======= UI helpers =======
function $(id){ return document.getElementById(id); }
function show(el){ el.classList.remove('hidden'); }
function hide(el){ el.classList.add('hidden'); }

// ticket generator used in mock mode and to display
function generateTicket(){
  const cols = [
    {min:1,max:9},{min:10,max:19},{min:20,max:29},{min:30,max:39},{min:40,max:49},
    {min:50,max:59},{min:60,max:69},{min:70,max:79},{min:80,max:90}
  ];
  let counts = Array(9).fill(1);
  let rem = 15 - 9;
  while(rem>0){ const idx = Math.floor(Math.random()*9); if(counts[idx] < 3){ counts[idx]++; rem--; } }
  const colNums = counts.map((cnt,i)=>{ const s = new Set(); while(s.size < cnt){ const n = Math.floor(Math.random()*(cols[i].max - cols[i].min +1)) + cols[i].min; s.add(n);} return Array.from(s).sort((a,b)=>a-b); });
  const rows = [[],[],[]];
  for(let c=0;c<9;c++){
    const nums = colNums[c].slice();
    const available = [0,1,2];
    while(nums.length){
      if(available.length === 0) available.push(0,1,2);
      const r = available.splice(Math.floor(Math.random()*available.length),1)[0];
      rows[r].push({col:c, num: nums.shift()});
    }
  }
  for(let iter=0; iter<100; iter++){
    const countsR = rows.map(r=>r.length);
    const over = countsR.findIndex(n=> n>5);
    const under = countsR.findIndex(n=> n<5);
    if(over === -1 && under === -1) break;
    if(over !== -1 && under !== -1){
      rows[under].push(rows[over].splice(0,1)[0]);
    } else break;
  }
  const matrix = Array.from({length:3}, ()=> Array(9).fill(null));
  for(let r=0;r<3;r++) rows[r].forEach(it=> matrix[r][it.col] = it.num);
  return matrix;
}

// ======= Event bindings =======
window.addEventListener('load', ()=>{
  // create
  $('createRoomBtn').addEventListener('click', async ()=>{
    const hostName = $('hostName').value.trim();
    const res = await postAPI({action:'createRoom', hostName});
    if(res.ok){
      localStorage.setItem('roomCode', res.roomCode);
      localStorage.setItem('hostToken', res.hostToken);
      $('createInfo').innerHTML = `Room created: <b>${res.roomCode}</b> — hostToken stored locally`;
      // show dividends form
      show($('dividendSection'));
      renderDivInputs();
    } else {
      alert('Error creating room: ' + (res.error || JSON.stringify(res)));
    }
  });

  // local mock create
  $('createMockRoomBtn').addEventListener('click', async ()=>{
    const hostName = $('hostName').value.trim() || 'Host';
    const res = await mockAPI({action:'createRoom', hostName});
    if(res.ok){
      localStorage.setItem('roomCode', res.roomCode);
      localStorage.setItem('hostToken', res.hostToken);
      $('createInfo').innerHTML = `Local mock room: <b>${res.roomCode}</b>`;
      show($('dividendSection'));
      renderDivInputs();
    }
  });

  // save dividends
  $('saveDivsBtn').addEventListener('click', async ()=>{
    const roomCode = localStorage.getItem('roomCode');
    if(!roomCode) return alert('Create a room first');
    const inputs = document.querySelectorAll('#divInputs .div-row');
    const arr = [];
    inputs.forEach(row=>{
      const name = row.querySelector('.dname').value.trim();
      const amount = Number(row.querySelector('.damount').value) || 0;
      if(name) arr.push({name, amount});
    });
    const res = await postAPI({action:'setDividends', roomCode, dividends: arr});
    if(res.ok){ alert('Dividends saved'); renderRoom(); }
    else alert('Err: '+(res.error||JSON.stringify(res)));
  });
  $('clearDivsBtn').addEventListener('click', ()=>{ document.getElementById('divInputs').innerHTML=''; });

  // join
  $('joinBtn').addEventListener('click', async ()=>{
    const roomCode = $('joinRoomCode').value.trim() || localStorage.getItem('roomCode');
    const playerName = $('playerName').value.trim() || ('Player'+Math.floor(Math.random()*99));
    if(!roomCode) return alert('Enter room code or create a room first');
    const res = await postAPI({action:'joinRoom', roomCode, playerName});
    if(res.ok){ localStorage.setItem('playerId', res.playerId); localStorage.setItem('roomCode', roomCode); showTicket(res.ticket); renderRoom(); }
    else alert('Err: '+(res.error||JSON.stringify(res)));
  });

  // refresh
  $('refreshBtn').addEventListener('click', renderRoom);
});

// render div inputs defaults
function renderDivInputs(){
  const container = $('divInputs');
  container.innerHTML = '';
  const defaultDivs = ['Full House','Early Five','Line 1','Line 2','Corners'];
  defaultDivs.forEach(name=>{
    const row = document.createElement('div'); row.className = 'div-row input-inline';
    const inName = document.createElement('input'); inName.className = 'dname'; inName.value = name; inName.style.flex = '1';
    const inAmt = document.createElement('input'); inAmt.className = 'damount'; inAmt.placeholder = 'amount'; inAmt.style.width = '110px';
    row.appendChild(inName); row.appendChild(inAmt);
    container.appendChild(row);
  });
}

// render room area (state)
async function renderRoom(){
  const roomCode = localStorage.getItem('roomCode') || $('joinRoomCode').value.trim();
  if(!roomCode) { $('roomArea').innerHTML = ''; return; }
  const res = await postAPI({action:'getRoom', roomCode});
  if(!res.ok){ $('roomArea').innerHTML = `<div class="card"><div class="info">Room not found</div></div>`; return; }
  const room = res.room;
  const players = res.players || [];
  const dividends = res.dividends || [];
  const claims = res.claims || [];
  const drawn = room.Drawn || [];
  const isHost = localStorage.getItem('hostToken') && localStorage.getItem('hostToken') === room.HostToken;

  let html = '';
  html += `<div class="card"><div style="display:flex;align-items:center;gap:12px"><div><b>Room: ${room.RoomCode}</b></div><div class="muted">Host: ${room.HostName}</div><div class="muted">Players: ${players.length}</div>`;
  if(isHost) html += `<div style="margin-left:auto"><button id="drawBtn" class="btn primary">Draw Number</button></div>`;
  html += `</div></div>`;

  // drawn numbers
  html += `<div class="card"><b>Drawn Numbers</b><div style="margin-top:8px">`;
  for(let i=1;i<=90;i++){
    const cls = drawn.indexOf(i)!==-1 ? 'num-drawn' : 'num-badge';
    html += `<span class="${cls}">${i}</span>`;
  }
  html += `</div></div>`;

  // players grid
  html += `<div class="grid">`;
  players.forEach(p=>{
    html += `<div class="card"><div style="display:flex;justify-content:space-between"><div><b>${p.PlayerName}</b></div><div class="muted">${p.PlayerId}</div></div>`;
    html += `<div class="ticket">${ticketHtml(p.Ticket, drawn)}</div>`;
    if(localStorage.getItem('playerId') === p.PlayerId) html += `<div style="margin-top:8px"><button id="regenBtn" class="btn ghost">Regenerate Ticket</button></div>`;
    html += `</div>`;
  });
  html += `</div>`;

  // dividends & claims
  html += `<div class="card"><b>Dividends</b><div class="muted">`;
  if(dividends.length) dividends.forEach(d=> html += `<div>${d.name} : ₹${d.amount}</div>`);
  else html += `<div class="muted">No dividends set</div>`;
  html += `</div></div>`;

  html += `<div class="card"><b>Claims / Winners</b>`;
  if(claims.length){
    claims.forEach(c=> html += `<div class="claim">${c.DividendName} → ${c.PlayerName} (₹${c.Amount})</div>`);
  } else html += `<div class="muted">No winners yet</div>`;
  html += `</div>`;

  $('roomArea').innerHTML = html;

  // attach dynamic handlers
  if(isHost){
    const drawBtn = document.getElementById('drawBtn');
    if(drawBtn) drawBtn.addEventListener('click', async ()=>{
      const hostToken = localStorage.getItem('hostToken');
      const r = await postAPI({action:'drawNext', roomCode: room.RoomCode, hostToken});
      if(r.ok){ alert('Number drawn: ' + r.number); renderRoom(); }
      else alert('Err: ' + (r.error||JSON.stringify(r)));
    });
  }
  const regenBtn = document.getElementById('regenBtn');
  if(regenBtn) regenBtn.addEventListener('click', async ()=>{
    const playerId = localStorage.getItem('playerId');
    const r = await postAPI({action:'regenerateTicket', playerId});
    if(r.ok){ alert('Ticket regenerated'); showTicket(r.ticket); renderRoom(); } else alert('Err: '+(r.error||JSON.stringify(r)));
  });
}

// show ticket area after join/regenerate
function showTicket(ticket){
  $('roomArea').innerHTML = `<div class="card"><h3>Your ticket</h3>${ticketHtml(ticket, [])}</div>`;
}

function ticketHtml(ticket, drawn){
  if(!ticket) return '<div class="muted">No ticket</div>';
  let html = '<table class="ticket-table">';
  for(let r=0;r<3;r++){
    html += '<tr>';
    for(let c=0;c<9;c++){
      const v = ticket[r][c];
      if(v === null || v === undefined) html += `<td class="empty">-</td>`;
      else html += `<td class="${drawn && drawn.indexOf(v)!==-1 ? 'num-drawn' : 'num-badge'}">${v}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}
