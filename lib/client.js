const net = require("net");
const util = require('util');

module.exports = (port, host, opts) => {
    const { openPort, localHost = 'localhost', localPort = 80 } = opts;

    let main_socket = null;
    let pool_socket = [];

    function createPoolConnect(n) {
        for (let i = 0; i < n; i++) {
            let sock = net.connect(port, host, () => {
                sock.write(JSON.stringify({ bindPort: openPort }));
                pool_socket.push(sock);
            })
                .on('error', e => {
                    console.error(e);
                    let i = pool_socket.indexOf(sock);
                    pool_socket.splice(i, 1);
                })
                .on('close', () => {
                    let i = pool_socket.indexOf(sock);
                    pool_socket.splice(i, 1);
                })
                .on('data', data => {
                    if (sock.upstream) {
                        sock.upstream.write(data);
                    } else {
                        sock.upstream = net.connect(localPort, localHost, ()=>{
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
        .on('error', e => {
            console.error(e);
        })
        .on('connect', () => {
            // 请求打开服务端口
            main_socket.write(JSON.stringify({ openPort }));
            console.info(`connected`);
        })
        .on("data", data => {
            try {
                console.debug(data.toString());
                let { error, success, openPort, connect } = JSON.parse(data.toString());
                if (error) console.error(e);
                if (openPort && success) {
                    createPoolConnect(10);
                }
                if (connect) {
                    createPoolConnect(connect);
                }
            } catch (e) {
                console.error(e);
            }
        })
        .on('end', console.info);

    return {
        close: () => {
            if (main_socket) {
                main_socket.end(() => main_socket = null);
            }
        }
    }
}