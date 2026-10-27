const http = require('http');

async function testModel(modelName) {
  const postData = JSON.stringify({
    model: modelName,
    messages: [{ role: 'user', content: 'Trả lời đúng 1 chữ: 1+1 bằng mấy?' }]
  });

  const options = {
    hostname: 'localhost',
    port: 20128,
    path: '/v1/chat/completions',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer sk-REPLACE-WITH-YOUR-KEY',
      'Content-Length': Buffer.byteLength(postData)
    }
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log(`[${modelName}] Status: ${res.statusCode} | Res: ${data.slice(0, 150)}`);
        resolve({ model: modelName, status: res.statusCode, body: data });
      });
    });

    req.on('error', (err) => {
      console.log(`[${modelName}] Error:`, err.message);
      resolve({ model: modelName, error: err.message });
    });

    req.write(postData);
    req.end();
  });
}

async function run() {
  await testModel('gemini-auto');
  await testModel('ag/gemini-3.8-flash-high');
  await testModel('gc/gemini-2.5-flash');
  await testModel('kr/claude-sonnet-4.5');
}

run();
