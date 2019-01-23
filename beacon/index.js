const cmd = require('commander');
const BeaconAPI = require('./beacon-api');
const BeaconChain = require('./beacon-chain');
const DB = require('./db');
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
    .option('-w, --withdrawalContract <address>', 'The address of the Casper Withdrawal contract')
    .option('-f, --from <address>', 'The address to make Casper Withdrawal transactions from')
    .option('-n, --noDatabase', 'Do not use a database for persistent beacon chain state')
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
        if (!cmd.withdrawalContract) throw new Error('Withdrawal contract address required (-d, --withdrawalContract <address>).');
        if (!cmd.withdrawalContract.match(/^(0x)?[0-9a-f]{40}$/i)) throw new Error('Invalid withdrawal contract address.');
        if (!cmd.from) throw new Error('From address required (-f, --from <address>).');
        if (!cmd.from.match(/^(0x)?[0-9a-f]{40}$/i)) throw new Error('Invalid from address.');
        cmd.noDatabase = !!cmd.noDatabase;

        // Create services
        let db = (cmd.noDatabase ? null : new DB());
        let beaconChain = new BeaconChain();
        let powChain = new PowChain();
        let beaconAPI = new BeaconAPI();

        // Initialise services
        if (!cmd.noDatabase) db.init([beaconChain, powChain]);
        beaconChain.init(cmd, (cmd.noDatabase ? null : db.db), powChain);
        powChain.init(cmd, (cmd.noDatabase ? null : db.db), beaconChain);
        beaconAPI.init(cmd, beaconChain);

    }
    catch (e) {
        console.log(e.message);
    }
}
start();
