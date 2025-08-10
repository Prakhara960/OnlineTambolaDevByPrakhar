// Replace API_URL with your deployed Apps Script Web App URL (doGet style)
const API_URL = "https://script.google.com/macros/s/AKfycbyfXWKbmnIsqYofRdWFhoUKhQMXq2RptSwaZRFpa8uwxuY3vN7m9IZuERGot6o8wAnV/exec";

function showHost(){
  document.getElementById('homePanel').style.display = 'none';
  document.getElementById('joinPanel').style.display = 'none';
  document.getElementById('hostPanel').style.display = 'block';
}

function showJoin(){
  document.getElementById('homePanel').style.display = 'none';
  document.getElementById('hostPanel').style.display = 'none';
  document.getElementById('joinPanel').style.display = 'block';
}

function createRoom(){
  const hostName = encodeURIComponent(document.getElementById('hostName').value || 'Host');
  fetch(`${API_URL}?action=createRoom&hostName=${hostName}`)
    .then(r=>r.json())
    .then(data=>{
      if(data.success){
        document.getElementById('hostInfo').innerHTML = 'Room Created - Code: <b>' + data.roomCode + '</b>';
        showDividendsForm(data.roomCode);
      } else {
        alert('Error creating room: ' + (data.error || JSON.stringify(data)));
      }
    })
    .catch(err=> alert('Network error: '+err));
}

function showDividendsForm(roomCode){
  document.getElementById('dividendsPanel').style.display = 'block';
  const list = document.getElementById('dividendList');
  list.innerHTML = '';
  ['Full House','Early Five','Line 1','Line 2','Corners'].forEach(name=>{
    const id = 'd_' + name.replace(/\s+/g,'_');
    list.innerHTML += `<div style="margin-bottom:6px"><label>${name}:</label> <input id="${id}" placeholder="amount" /> </div>`;
  });
  // store current room code
  document.getElementById('hostInfo').dataset.room = roomCode;
}

function saveDividends(){
  const roomCode = document.getElementById('hostInfo').dataset.room;
  if(!roomCode) return alert('Room code missing');
  const inputs = document.querySelectorAll('#dividendList input');
  const arr = [];
  inputs.forEach(inp=>{
    const name = inp.previousSibling ? inp.previousSibling.textContent : 'Prize';
    arr.push({name: name.replace(':','').trim(), amount: inp.value || '0'});
  });
  const payload = encodeURIComponent(JSON.stringify(arr));
  fetch(`${API_URL}?action=setDividends&roomCode=${roomCode}&dividends=${payload}`)
    .then(r=>r.json())
    .then(data=>{
      if(data.success) alert('Dividends saved');
      else alert('Error: ' + (data.error || JSON.stringify(data)));
    });
}

function joinRoom(){
  const roomCode = document.getElementById('joinCode').value.trim();
  const playerName = encodeURIComponent(document.getElementById('playerName').value || 'Player');
  if(!roomCode) return alert('Enter room code');
  fetch(`${API_URL}?action=joinRoom&roomCode=${roomCode}&playerName=${playerName}`)
    .then(r=>r.json())
    .then(data=>{
      if(data.success){
        showTicket(data.ticket);
      } else {
        alert('Error joining: ' + (data.error || JSON.stringify(data)));
      }
    });
}

function showTicket(ticket){
  let html = '<h3>Your Ticket</h3><table>';
  ticket.forEach(row=>{
    html += '<tr>';
    row.forEach(cell=>{
      html += '<td>'+ (cell || '') + '</td>';
    });
    html += '</tr>';
  });
  html += '</table>';
  document.getElementById('ticketDisplay').innerHTML = html;
}
