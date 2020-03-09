const net = require("net");

module.exports = (port, origin) => {
    // 连接池
    const pool = [];

    function wait_connect() {
        origin.write(JSON.stringify({ connect: 1 }));

        return new Promise(function (resolve, reject) {
            let sock = pool.pop();
            if (sock) {
                resolve(sock);
                return;
            }

            // 定时检测，等待连接建立
            setImmediate(check);

            function check() {
                let sock = pool.pop();
                if (!sock) {
                    setImmediate(check);
                    return;
                }
                resolve(sock);
            }
        });
    }

    return new Promise(function (resolve, reject) {
        const server = net.createServer()
            .on('error', e => {
                console.error(`service error: ${e.stack}`);
                reject(e);
            })
            .on('connection', async request => {
                let upstream = await wait_connect();

                request
                    .on('error', e => {
                        console.error(`request error: ${e.stack}`);
                    })
                    .on('end', () => upstream.end())
                    .on('close', () => upstream.end())
                    .on('data', data => {
                        if (!upstream.destroyed) { upstream.write(data); }
                    });

                upstream
                    .on('error', e => {
                        console.error(`upstream error: ${e.stack}`);
                    })
                    .on('end', () => request.end())
                    .on('close', () => request.end())
                    .on('data', data => {
                        if (!request.destroyed) { request.write(data); }
                    });
            })
            .listen(port, () => {
                console.info(`open service on port ${port}`);
                resolve({
                    release: sock => {
                        sock.on('close', () => {
                            let i = pool.indexOf(sock);
                            if (i >= 0) pool.splice(i, 1);
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

