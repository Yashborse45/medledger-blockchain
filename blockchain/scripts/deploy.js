// Deploy script for AuditLogger contract
// Usage: npx hardhat run scripts/deploy.js --network ganache
const hre = require('hardhat');
const fs = require('fs');
const path = require('path');

async function main() {
    console.log('Deploying AuditLogger...');

    const AuditLogger = await hre.ethers.getContractFactory('AuditLogger');
    const contract = await AuditLogger.deploy();
    await contract.waitForDeployment();

    const address = await contract.getAddress();
    console.log(`\nAuditLogger deployed to: ${address}`);
    console.log('\nAdd this to backend/.env:');
    console.log(`CONTRACT_ADDRESS=${address}`);

    const artifactPath = path.join(
        __dirname,
        '../artifacts/contracts/AuditLogger.sol/AuditLogger.json'
    );
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

    // ── Copy ABI to backend config ──────────────────────────────────────────────
    const destPath = path.join(
        __dirname,
        '../../backend/src/config/AuditLoggerABI.json'
    );
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`\nABI copied to backend/src/config/AuditLoggerABI.json`);

    // ── Write Truffle-compatible artifact so Ganache GUI can decode events ──────
    // Ganache reads build/contracts/<Name>.json when a truffle-config.js is linked
    const network = hre.network;
    const chainId = network.config.chainId || 1337;
    const truffleBuildPath = path.join(__dirname, '../build/contracts/AuditLogger.json');
    fs.mkdirSync(path.dirname(truffleBuildPath), { recursive: true });

    const truffleArtifact = {
        contractName: 'AuditLogger',
        abi: artifact.abi,
        bytecode: artifact.bytecode,
        networks: {
            [chainId]: {
                address,
                transactionHash: contract.deploymentTransaction()?.hash || '',
            },
        },
    };
    fs.writeFileSync(truffleBuildPath, JSON.stringify(truffleArtifact, null, 2));
    console.log(`\nTruffle artifact written to blockchain/build/contracts/AuditLogger.json`);
    console.log(`\n--- Ganache setup (one-time) ---`);
    console.log(`In Ganache GUI: Settings → Workspace → ADD PROJECT`);
    console.log(`Point to: ${path.join(__dirname, '../truffle-config.js')}`);
    console.log(`Then click SAVE AND RESTART — events will decode in all future transactions.`);
}

main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
});
