const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws');
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'start', candidates: [{firstName: "a", lastName: "b"}] }));
});
ws.on('message', (msg) => {
  const data = JSON.parse(msg.toString());
  if (data.type === 'log') {
    console.log("LOG:", data.msg);
  } else if (data.type === 'error' || data.type === 'sys_error') {
    console.log("ERROR:", data.msg);
  } else if (data.type === 'audio') {
    console.log("AUDIO RECEIVED! length:", data.audio.length, "content start:", data.audio.substring(0, 50));
    // don't exit to see if more comes
  } else {
    console.log("OTHER:", data.type);
  }
});

setTimeout(() => process.exit(0), 10000); // exit after 10s
