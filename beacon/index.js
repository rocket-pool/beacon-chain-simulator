const cmd = require('commander');
const BeaconAPI = require('./beacon-api');
const BeaconChain = require('./beacon-chain');
const PowChain = require('./pow-chain');

// Default PoW web3 host
const DEFAULT_POW_WEB3_HOST = 'ws://127.0.0.1:8545';

// Default beacon API websocket port
const DEFAULT_API_WS_PORT = '8555';

// Initialisa CLI
cmd
    .option('-h, --powHost <address>', 'The address of the PoW chain web3 host')
    .option('-p, --apiPort <port>', 'The beacon API websocket port')
    .option('-d, --depositContract <address>', 'The address of the Casper Deposit contract')
    .parse(process.argv);

// Start beacon chain simulator
function start() {
    try {

        // Process CLI arguments
        if (!cmd.powHost) cmd.powHost = DEFAULT_POW_WEB3_HOST;
        if (!cmd.apiPort) cmd.apiPort = DEFAULT_API_WS_PORT;
        if (!cmd.apiPort.match(/^\d{1,5}$/)) throw new Error('Invalid beacon API websocket port.');
        if (!cmd.depositContract) throw new Error('Deposit contract address required (-d, --depositContract <address>).');
        if (!cmd.depositContract.match(/^(0x)?[0-9a-f]{40}$/i)) throw new Error('Invalid deposit contract address.');

        // Create services
        let beaconChain = new BeaconChain();
        let powChain = new PowChain();
        let beaconAPI = new BeaconAPI();

        // Initialise services
        beaconChain.init(cmd, powChain);
        powChain.init(cmd);
        beaconAPI.init(cmd);

    }
    catch (e) {
        console.log(e.message);
    }
}
start();
