const qrcode = require('qrcode');
const path = require('path');
const url = 'exps://partial-chicago-santa-heading.trycloudflare.com';
qrcode.toFile(path.join('C:\\Users\\jpmit\\Code\\LunchMeet', 'expo-go-qr.png'), url, { width: 400, margin: 2 }, (err) => {
  if (err) { console.error(err); process.exit(1); }
  console.log('QR saved');
});
