const net = require("net");
const service = require('./service');

module.exports = (port, callback) => {
    let service_map = new Map();

    // 实例化一个服务器对象
    let server = net.createServer()
        .on('error', (e) => {
            console.error(`server error: ${e.stack}`);
            server.close();
        })
        .on('connection', sock => {
            sock.setNoDelay(true)
                .on('data', data => {
                    let cmd = {};
                    try {
                        cmd = JSON.parse(data.toString());
                    }
                    catch (e) {
                        console.error(`invalid package: ${data.toString()}`);
                        sock.end();
                        return;
                    }
                    let { key, openPort, bindPort } = cmd;
                    sock.removeAllListeners('data');

                    // 打开服务端口
                    if (openPort) {
                        sock
                            .on('error', e => {
                                console.error(`origin connection error: ${e.stack}`);
                                sock.destroy();
                            })
                            .on('end', () => {
                                sock.end();
                            })
                            .on('close', () => {
                                sock.service.stop();
                            });
                        service(openPort, (msg) => sock.write(msg)).then(openService => {
                            service_map.set(openPort, openService);
                            sock.service = openService;
                            sock.write(JSON.stringify({ openPort, success: true }));
                        }).catch(e => {
                            sock.write(JSON.stringify({ openPort, success: false, error: e.stack }));
                        });
                    }

                    // 绑定到服务的连接池
                    if (bindPort) {
                        let openService = service_map.get(bindPort);
                        if (!openService) {
                            console.error(`open service not exist`);
                            return;
                        }
                        openService.release(sock);
                    }
                });
        })
        .listen(port, () => {
            console.info(`server working on port ${port}`);
            if (callback) callback();
        });

    return {
        stop: () => {
            server.close(() => {
                console.info(`server stoped`);
                server = null;
            });
        }
    };
}