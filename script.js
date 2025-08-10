// Replace with your Apps Script Web App URL
const GAS_URL = 'https://script.google.com/macros/s/AKfycbwLhFWjzwB2gv1MJEEOnLJgG64Sv6p6FueYEQCDKsFXsS1AkJ8QKBPlX4aIpF7GDia3/exec'; // <-- REPLACE

async function api(action, payload){
  payload = payload || {};
  payload.action = action;
  const res = await fetch(GAS_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(payload)
  });
  return await res.json();
}

// Create room
document.getElementById('createBtn').addEventListener('click', async ()=>{
  const hostName = document.getElementById('hostName').value || 'Host';
  const res = await api('createRoom',{hostName});
  if(res.ok){
    document.getElementById('createInfo').innerText = `Room created: ${res.roomCode} (hostToken stored locally)`;
    localStorage.setItem('roomCode', res.roomCode);
    localStorage.setItem('hostToken', res.hostToken);
    // show dividends inputs
    showDivInputs();
  } else alert('Error: '+(res.error||''));
});

function showDivInputs(){
  document.getElementById('divForm').style.display = 'block';
  const divs = ['Full House','Early Five','Line','Line 2','Corners']; // default labels
  const container = document.getElementById('divInputs');
  container.innerHTML = '';
  divs.forEach(d=>{
    const id = 'd_' + d.replace(/\s+/g,'_');
    container.innerHTML += `<div style="margin-bottom:6px"><label>${d}:</label> <input id="${id}" placeholder="amount"></div>`;
  });
}

document.getElementById('saveDivsBtn').addEventListener('click', async ()=>{
  const roomCode = localStorage.getItem('roomCode');
  if(!roomCode) return alert('Room not created');
  const inputs = document.querySelectorAll('#divInputs input');
  const arr = [];
  inputs.forEach(inp=>{
    const label = inp.previousSibling.textContent || 'Prize';
    arr.push({name: label.replace(':','').trim(), amount: Number(inp.value) || 0});
  });
  const res = await api('setDividends', {roomCode, dividends: arr});
  if(res.ok) alert('Dividends saved');
  else alert('Err: '+(res.error||''));
});

// Join room
document.getElementById('joinBtn').addEventListener('click', async ()=>{
  const roomCode = document.getElementById('joinCode').value.trim();
  const playerName = document.getElementById('playerName').value.trim() || ('Player'+Math.floor(Math.random()*99));
  if(!roomCode) return alert('Enter room code');
  const res = await api('joinRoom', {roomCode, playerName});
  if(res.ok){
    localStorage.setItem('playerId', res.playerId);
    localStorage.setItem('roomCode', roomCode);
    showTicket(res.ticket);
    renderRoom();
  } else alert('Err: '+(res.error||''));
});

// Regenerate
async function regenerate(){
  const playerId = localStorage.getItem('playerId');
  if(!playerId) return alert('Not joined');
  const res = await api('regenerateTicket', {playerId});
  if(res.ok){ alert('Ticket regenerated'); showTicket(res.ticket); renderRoom(); }
  else alert('Err: '+(res.error||''));
}

// Draw number (host)
async function drawNumber(){
  const roomCode = localStorage.getItem('roomCode');
  const hostToken = localStorage.getItem('hostToken');
  if(!roomCode || !hostToken) return alert('Host not recognized');
  const res = await api('drawNext', {roomCode, hostToken});
  if(res.ok){
    alert('Number drawn: '+res.number);
    renderRoom();
  } else alert('Err: '+(res.error||''));
}

// render room state
document.getElementById('refreshBtn').addEventListener('click', renderRoom);
async function renderRoom(){
  const roomCode = localStorage.getItem('roomCode') || document.getElementById('joinCode').value.trim();
  if(!roomCode) { document.getElementById('roomArea').innerHTML = ''; return; }
  const r = await api('getRoom', {roomCode});
  if(!r.ok){ document.getElementById('roomArea').innerHTML = '<div class="card small">Room not found</div>'; return; }
  const {room, players, dividends, claims} = r;
  const isHost = localStorage.getItem('hostToken') && localStorage.getItem('hostToken') === room.HostToken;
  let html = '';
  html += `<div class="card"><div style="display:flex;align-items:center;gap:12px"><div><b>Room:</b> ${room.RoomCode}</div><div class="small">Host: ${room.HostName}</div><div class="small">Players: ${players.length}</div>`;
  if(isHost) html += `<div style="margin-left:auto"><button id="drawBtn">Draw Number</button></div>`;
  html += `</div></div>`;
  // drawn numbers
  const drawn = room.Drawn || [];
  html += `<div class="card"><b>Drawn Numbers</b><div style="margin-top:8px">`;
  for(let i=1;i<=90;i++){
    const cls = drawn.indexOf(i) !== -1 ? 'num-drawn' : 'num-badge';
    html += `<span class="${cls}">${i}</span>`;
  }
  html += `</div></div>`;
  // players
  html += `<div class="grid">`;
  players.forEach(p=>{
    html += `<div class="card"><div style="display:flex;justify-content:space-between"><div><b>${p.PlayerName}</b></div><div class="small">${p.PlayerId}</div></div>`;
    html += `<div class="ticket">${ticketHtml(p.Ticket, drawn)}</div>`;
    if(localStorage.getItem('playerId') === p.PlayerId) html += `<div style="margin-top:8px"><button id="regenBtn">Regenerate Ticket</button></div>`;
    html += `</div>`;
  });
  html += `</div>`;
  // claims
  html += `<div class="card"><b>Claims / Winners</b><div class="small">`;
  if(claims && claims.length) claims.forEach(c=> html += `<div class="small">[${c.DividendName}] ${c.PlayerName} | Amount: ${c.Amount} | ${c.ClaimedAt}</div>`);
  else html += `<div class="small">No winners yet</div>`;
  html += `</div></div>`;
  document.getElementById('roomArea').innerHTML = html;
  if(isHost){
    document.getElementById('drawBtn').addEventListener('click', drawNumber);
  }
  const regen = document.getElementById('regenBtn'); if(regen) regen.addEventListener('click', regenerate);
}

function ticketHtml(ticket, drawn){
  if(!ticket || ticket.length === 0) return '<div class="small">No ticket</div>';
  let html = '<table class="ticket-table">';
  for(let r=0;r<3;r++){
    html += '<tr>';
    for(let c=0;c<9;c++){
      const v = ticket[r][c];
      if(v === null || v === undefined) html += `<td class="empty">-</td>`;
      else html += `<td class="${drawn.indexOf(v)!==-1?'num-drawn':'num-badge'}">${v}</td>`;
    }
    html += '</tr>';
  }
  html += '</table>';
  return html;
}

// show ticket after join
function showTicket(ticket){
  const area = document.getElementById('roomArea');
  area.innerHTML = `<div class="card"><h3>Your ticket</h3>${ticketHtml(ticket, [])}</div>`;
}
