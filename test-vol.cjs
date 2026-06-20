const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:3000/ws');
ws.on('open', () => {
  ws.send(JSON.stringify({ type: 'start', candidates: [{firstName: "a", lastName: "b"}] }));
});
ws.on('message', (msg) => {
  const data = JSON.parse(msg.toString());
  if (data.type === 'audio') {
    const binaryString = atob(data.audio);
    let maxVal = 0;
    for (let i = 0; i < binaryString.length; i += 2) {
      let b1 = binaryString.charCodeAt(i);
      let b2 = binaryString.charCodeAt(i+1);
      let val = b1 | (b2 << 8);
      if (val >= 32768) val -= 65536;
      let fVal = Math.abs(val) / 32768.0;
      if (fVal > maxVal) maxVal = fVal;
    }
    console.log("AUDIO chunk max volume:", maxVal);
  }
});

setTimeout(() => process.exit(0), 10000);
