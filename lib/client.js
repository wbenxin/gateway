const net = require("net");
const crypto = require('crypto');

module.exports = (port, host, opts) => {
    const { openPort, localHost = 'localhost', localPort = 80, key = 'wbenxin' } = opts;

    let main_socket = null;
    let pool_socket = [];

    let message = Math.random().toString(36).substr(3);
    const hmac = crypto.createHmac('sha256', key);
    hmac.update(message);
    const signature = hmac.digest('hex');
    let identity = { message, signature };

    function createPoolConnect(n) {
        for (let i = 0; i < n; i++) {
            let sock = net.connect(port, host)
                .setKeepAlive(true)
                .setNoDelay(true)
                .on('error', e => {
                    console.error(e);
                    let i = pool_socket.indexOf(sock);
                    pool_socket.splice(i, 1);
                })
                .on('close', () => {
                    let i = pool_socket.indexOf(sock);
                    pool_socket.splice(i, 1);
                })
                .on('connect', () => {
                    sock.write(JSON.stringify({ bindPort: openPort, identity }));
                    pool_socket.push(sock);
                })
                .on('data', data => {
                    if (sock.upstream) {
                        sock.upstream.write(data);
                    } else {
                        sock.upstream = net.connect(localPort, localHost, () => {
                            sock.upstream.write(data);
                        });
                        sock.upstream
                            .on('error', console.error)
                            .on('data', data => {
                                sock.write(data);
                            })
                            .on('close', () => {
                                sock.upstream = null;
                            });
                    }
                });
        }
    }

    main_socket = net.connect(port, host)
        .setEncoding('utf8')
        .setKeepAlive(true)
        .setNoDelay(true)
        .on('error', e => {
            console.error(e);
        })
        .on('connect', () => {
            // 请求打开服务端口
            main_socket.write(JSON.stringify({ openPort, identity }));
        })
        .on("data", data => {
            let jsons = data.toString().match(/{.*?}/g);
            jsons.forEach(json => {
                let cmd = {};
                try {
                    cmd = JSON.parse(json);
                } catch (e) {
                    console.error(`invalid package: ${json}`);
                    return;
                }
                let { error, success, openPort, connect } = cmd;

                if (error) console.error(`remote error: ${error}`);
                if (openPort && success) {
                    console.info(`openPort success`);
                    createPoolConnect(1);
                }
                if (connect) {
                    createPoolConnect(connect);
                }
            });
        });

    return {
        close: () => {
            if (main_socket) {
                main_socket.end(() => main_socket = null);
            }
        }
    }
}