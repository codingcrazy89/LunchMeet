const { Tunnel } = require('cloudflared');
const fs = require('fs');
const path = require('path');
const t = Tunnel.quick('http://localhost:8081');
t.once('url', u => {
  fs.writeFileSync(path.join('C:\\Users\\jpmit\\Code\\LunchMeet', '.cf-metro-url'), u);
  console.log('METRO:' + u);
});
t.once('error', e => { console.error(e.message); process.exit(1); });
setTimeout(() => { if (!fs.existsSync(path.join('C:\\Users\\jpmit\\Code\\LunchMeet', '.cf-metro-url'))) { console.error('TIMEOUT'); process.exit(1); } }, 25000);
