require('@nomicfoundation/hardhat-toolbox');
require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });

const PRIVATE_KEY = process.env.BLOCKCHAIN_PRIVATE_KEY || '0x0000000000000000000000000000000000000000000000000000000000000001';
const RPC_URL = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:7545';

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
    solidity: '0.8.20',
    networks: {
        ganache: {
            url: RPC_URL,
            chainId: 1337,
            accounts: [PRIVATE_KEY],
        },
    },
};
