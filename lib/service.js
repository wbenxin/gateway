const net = require("net");

module.exports = (port, origin) => {
    // 连接池
    const pool = [];
    let acquired = false;

    function acquire() {
        return new Promise(function (resolve, reject) {
            let sock = pool.pop();
            if (sock) {
                resolve(sock);
                return;
            }
            // 连接池空了，请求再建立10个连接
            if (!acquired) {
                origin.write(JSON.stringify({ connect: 10 }));
                acquired = true;
            }
            // 定时检测，等待连接建立
            let t = setInterval(() => {
                let sock = pool.pop();
                if (sock) {
                    acquired = false;
                    resolve(sock);
                    clearInterval(t);
                }
            }, 100);
        });
    }

    setInterval(() => {
        // 清理连接池
        if (pool.length > 10) {
            let free = pool.splice(10, pool.length - 10);
            free.forEach(sock => sock.end());
        }
    }, 1000 * 30);

    return new Promise(function (resolve, reject) {
        const server = net.createServer()
            .on('error', e => {
                console.error(e);
                reject(e);
            })
            .on('connection', async request => {
                request.upstream = await acquire();
                request.on('error', console.error).on('close', () => {
                    if (request.upstream) {
                        // 解绑
                        request.upstream.removeAllListeners('data');
                        // 放回连接池
                        pool.push(request.upstream);
                    }
                });
                // 建立双向绑定
                request.upstream.on('data', data => {
                    request.write(data);
                });
                request.on('data', data => {
                    request.upstream.write(data);
                });
            })
            .listen(port, () => {
                console.info(`Started open service on port ${port}`);
                resolve({
                    release: sock => {
                        sock.on('end', () => {
                            let i = pool.indexOf(sock);
                            pool.splice(i, 1);
                        });
                        sock.on('error', e => {
                            console.error(e);
                        });
                        pool.push(sock);
                    },
                    stop: () => {
                        server.close();
                    },
                });
            });
    });
}

