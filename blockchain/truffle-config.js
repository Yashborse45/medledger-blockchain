// Minimal Truffle config — only exists so Ganache GUI can link this project
// and decode AuditLogger events. Actual deployment uses Hardhat, not Truffle.
module.exports = {
    contracts_build_directory: './build/contracts',
    networks: {
        ganache: {
            host: '127.0.0.1',
            port: 7545,
            network_id: '1337',
        },
    },
};
