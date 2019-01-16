const fs = require('fs');
const cmd = require('commander');
const Web3 = require('web3');

// Default web3 host
const defaultWeb3Host = 'http://127.0.0.1:8545';

// Get contract data
const depositContractABI = JSON.parse(fs.readFileSync(__dirname + '/../contracts/casper/Deposit.abi'));

// Initialise CLI
cmd
    .option('-h, --host <address>', 'The address of the web3 host')
    .option('-d, --depositContract <address>', 'The address of the Casper Deposit contract')
    .option('-f, --from <address>', 'The address to make the deposit from')
    .option('-a, --amount <number>', 'The amount in ETH to deposit', parseInt)
    .option('-p, --pubkey <key>', 'The public BLS key for the validator')
    .option('-w, --withdrawalPubkey <key>', 'The public BLS key for withdrawal from Casper')
    .option('-r, --randaoCommitment <hash32>', 'The validator\'s randao commitment hash')
    .option('-c, --custodyCommitment <hash32>', 'The validator\'s custody commitment hash')
    .parse(process.argv);

// Send validator deposit
async function validatorDeposit() {
    try {

        // Process CLI arguments
        if (!cmd.host) { cmd.host = defaultWeb3Host; }
        if (!cmd.depositContract) { throw new Error('Deposit contract address required (-d, --depositContract <address>).'); }
        if (!cmd.depositContract.match(/^(0x)?[0-9a-f]{40}$/i)) { throw new Error('Invalid deposit contract address.'); }
        if (!cmd.from) { throw new Error('From address required (-f, --from <address>).'); }
        if (!cmd.from.match(/^(0x)?[0-9a-f]{40}$/i)) { throw new Error('Invalid from address.'); }
        if (!cmd.amount) { throw new Error('Deposit amount required (-a, --amount <number>).'); }
        if (cmd.amount < 0) { throw new Error('Invalid deposit amount.'); }
        if (!cmd.pubkey) { throw new Error('Validator BLS pubkey required (-p, --pubkey <key>).'); }
        if (!cmd.pubkey.match(/^[0-9a-f]{96}$/i)) { throw new Error('Invalid validator BLS pubkey.'); }
        if (!cmd.withdrawalPubkey) { throw new Error('Withdrawal BLS pubkey required (-w, --withdrawalPubkey <key>).'); }
        if (!cmd.withdrawalPubkey.match(/^[0-9a-f]{96}$/i)) { throw new Error('Invalid withdrawal BLS pubkey.'); }
        if (!cmd.randaoCommitment) { throw new Error('Randao commitment required (-r, --randaoCommitment <hash32>).'); }
        if (!cmd.randaoCommitment.match(/^[0-9a-f]{64}$/i)) { throw new Error('Invalid randao commitment.'); }
        if (!cmd.custodyCommitment) { throw new Error('Custody commitment required (-c, --custodyCommitment <hash32>).'); }
        if (!cmd.custodyCommitment.match(/^[0-9a-f]{64}$/i)) { throw new Error('Invalid custody commitment.'); }

        // Initialise web3
        let web3 = new Web3(cmd.host);

        // Initialise contract
        let depositContract = new web3.eth.Contract(depositContractABI, cmd.depositContract);

    }
    catch (e) {
        console.log(e.message);
    }
}
validatorDeposit();
