const { server, client } = require('./index');
const http = require('http');

// 启动helloword服务器
http.createServer((req, res) => {
    res.end('Hello world');
}).listen(8888);

server(3000, () => {
    // 代理helloword服务器
    client(3000, 'localhost', { openPort: 8000, localHost: 'localhost', localPort: 8888 });
    // 代理wework.sdoil.cn
    client(3000, 'localhost', { openPort: 8080, localHost: 'wework.sdoil.cn', localPort: 80 });
});
