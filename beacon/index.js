const cmd = require('commander');
const PowChain = require('./powchain');

// Default PoW web3 host
const defaultWeb3PowHost = 'ws://127.0.0.1:8545';

// Initialisa CLI
cmd
    .option('-h, --powHost <address>', 'The address of the PoW chain web3 host')
    .option('-d, --depositContract <address>', 'The address of the Casper Deposit contract')
    .parse(process.argv);

// Start beacon chain simulator
function start() {
    try {

        // Process CLI arguments
        if (!cmd.powHost) { cmd.powHost = defaultWeb3PowHost; }
        if (!cmd.depositContract) { throw new Error('Deposit contract address required (-d, --depositContract <address>).'); }
        if (!cmd.depositContract.match(/^(0x)?[0-9a-f]{40}$/i)) { throw new Error('Invalid deposit contract address.'); }

        // Start PoW chain service
        powChain = new PowChain();
        powChain.init(cmd);

    }
    catch (e) {
        console.log(e.message);
    }
}
start();
