// One-time helper: generates build/contracts/AuditLogger.json in Truffle format
// so Ganache GUI can decode EventLogged events.
// Run with: node scripts/generate-truffle-artifact.js
const fs = require('fs');
const path = require('path');

const CONTRACT_ADDRESS = process.env.CONTRACT_ADDRESS || '0x72d4351497f80234b71291ffb41c960d6ABF2297';

const artifactPath = path.join(__dirname, '../artifacts/contracts/AuditLogger.sol/AuditLogger.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

const truffleArtifact = {
    contractName: 'AuditLogger',
    abi: artifact.abi,
    bytecode: artifact.bytecode,
    deployedBytecode: artifact.deployedBytecode,
    networks: {
        '1337': {
            address: CONTRACT_ADDRESS,
            transactionHash: '',
        },
    },
};

const outDir = path.join(__dirname, '../build/contracts');
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'AuditLogger.json'), JSON.stringify(truffleArtifact, null, 2));
console.log('Done: build/contracts/AuditLogger.json written for', CONTRACT_ADDRESS);
