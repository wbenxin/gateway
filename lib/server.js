const net = require("net");
const util = require('util');
const service = require('./service');

module.exports = (port, callback) => {
    let service_map = new Map();

    // 实例化一个服务器对象
    let server = net.createServer()
        .on("error", function (e) {
            console.error(e);
            process.exit();
        })
        .on('connection', sock => {
            console.log("new client connection!");
            sock.once('data', data => {
                try {
                    let { key, openPort, bindPort } = JSON.parse(data.toString());

                    // 打开服务端口
                    if (openPort) {
                        sock.on('error', e => {
                            console.error(e);
                        });
                        sock.on('close', () => {
                            if (sock.service) {
                                sock.service.stop();
                            }
                        });
                        service(openPort, sock).then(openService => {
                            service_map.set(openPort, openService);
                            sock.service = openService;
                            sock.write(JSON.stringify({ openPort, success: true }));
                        });
                    }

                    // 绑定到服务的连接池
                    if (bindPort) {
                        let openService = service_map.get(bindPort);
                        if (!openService) {
                            console.error(`openService not exist`);
                            return;
                        }
                        openService.release(sock);
                    }
                }
                catch (e) {
                    console.error(e);
                }
            });
        });

    // 设置监听端口
    server.listen(port, () => {
        console.info(`Started server on port ${port}`);
        if (callback) callback();
    });

    return {
        stop: () => {
            if (server) {
                server.close(() => {
                    console.info(`Server stoped`);
                    server = null;
                });
            }
        }
    };
}