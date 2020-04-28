#! /usr/bin/env node

require('console-color-mr');
const program = require('commander');
const package = require('./package.json');
const { server, client } = require('./index');

program
    .command('server [port]')
    .description('start the service with the specified port number(default to 3300)')
    .option('-k, --key <string>', 'the key value used to generate the encrypted signature')
    .action(port, options => {
        port = port || 3300;
        server(port, options);
    });

program
    .command('client <host> [port]')
    .description('connect to a service with the specified host and port number(default to 3300)')
    .requiredOption('-p, --openPort <number>', 'required. open port on remote server')
    .option('-k, --key <string>', 'the key value used to generate the encrypted signature')
    .option('-H, --localHost <string>', 'local service host. default to 127.0.0.1')
    .option('-P, --localPort <number>', 'local service port. default to 80')
    .action((host, port, options) => {
        port = port || 3300;
        client(port, host, options);
    });

program
    .version(package.version, '-v, --version')
    .parse(process.argv);