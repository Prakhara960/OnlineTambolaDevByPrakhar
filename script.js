const API_URL = "https://script.google.com/macros/s/AKfycbyfXWKbmnIsqYofRdWFhoUKhQMXq2RptSwaZRFpa8uwxuY3vN7m9IZuERGot6o8wAnV/exec";

function showHost() {
  document.getElementById("home").style.display = "none";
  document.getElementById("hostPanel").style.display = "block";
}

function showJoin() {
  document.getElementById("home").style.display = "none";
  document.getElementById("joinPanel").style.display = "block";
}

function createRoom() {
  const name = document.getElementById("hostName").value;
  fetch(`${API_URL}?action=createRoom&hostName=${encodeURIComponent(name)}`)
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        document.getElementById("hostInfo").innerHTML = `Room Created! Code: <b>${data.roomCode}</b>`;
        showDividendForm();
      }
    });
}

function showDividendForm() {
  document.getElementById("dividendsPanel").style.display = "block";
  const list = document.getElementById("dividendList");
  list.innerHTML = "";
  ["Full House", "Early Five", "Line 1", "Line 2", "Corners"].forEach(d => {
    list.innerHTML += `<input placeholder="Amount for ${d}" data-name="${d}"><br>`;
  });
}

function saveDividends() {
  const inputs = document.querySelectorAll("#dividendList input");
  const dividends = [];
  inputs.forEach(inp => {
    dividends.push({ name: inp.dataset.name, amount: inp.value });
  });
  fetch(`${API_URL}?action=setDividends&roomCode=${document.getElementById("hostInfo").innerText.split(": ")[1]}&dividends=${encodeURIComponent(JSON.stringify(dividends))}`)
    .then(r => r.json())
    .then(data => alert("Dividends saved!"));
}

function joinRoom() {
  const code = document.getElementById("joinCode").value;
  const name = document.getElementById("playerName").value;
  fetch(`${API_URL}?action=joinRoom&roomCode=${code}&playerName=${encodeURIComponent(name)}`)
    .then(r => r.json())
    .then(data => {
      if (data.success) {
        showTicket(data.ticket);
      }
    });
}

function showTicket(ticket) {
  let html = "<table>";
  ticket.forEach(row => {
    html += "<tr>";
    row.forEach(num => {
      html += `<td>${num || ""}</td>`;
    });
    html += "</tr>";
  });
  html += "</table>";
  document.getElementById("ticketDisplay").innerHTML = html;
}
