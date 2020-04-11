const net = require("net");

module.exports = (port, host, opts) => {
    const { openPort, localHost = 'localhost', localPort = 80 } = opts;

    let main_socket = null;
    let pool_socket = [];

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
                    sock.write(JSON.stringify({ bindPort: openPort }));
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
            main_socket.write(JSON.stringify({ openPort }));
            console.info(`connected`);
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