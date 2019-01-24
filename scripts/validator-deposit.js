const fs = require('fs');
const cmd = require('commander');
const ssz = require('ssz');
const Web3 = require('web3');

// Default web3 host
const DEFAULT_WEB3_HOST = 'http://127.0.0.1:8545';

// Get contract data
const depositContractABI = JSON.parse(fs.readFileSync(__dirname + '/../contracts/casper/Deposit.abi'));

// Initialise CLI
cmd
    .option('-h, --host <address>', 'The address of the web3 host')
    .option('-d, --depositContract <address>', 'The address of the Casper Deposit contract')
    .option('-f, --from <address>', 'The address to make the deposit from')
    .option('-a, --amount <number>', 'The amount in ETH to deposit')
    .option('-p, --pubkey <key>', 'The public BLS key for the validator')
    .option('-w, --withdrawalPubkey <key>', 'The public BLS key for withdrawal from Casper')
    .parse(process.argv);

// Send validator deposit
async function validatorDeposit() {
    try {

        // Process CLI arguments
        if (!cmd.host) cmd.host = DEFAULT_WEB3_HOST;
        if (!cmd.depositContract) throw new Error('Deposit contract address required (-d, --depositContract <address>).');
        if (!cmd.depositContract.match(/^(0x)?[0-9a-f]{40}$/i)) throw new Error('Invalid deposit contract address.');
        if (!cmd.from) throw new Error('From address required (-f, --from <address>).');
        if (!cmd.from.match(/^(0x)?[0-9a-f]{40}$/i)) throw new Error('Invalid from address.');
        if (!cmd.amount) throw new Error('Deposit amount required (-a, --amount <number>).');
        if (isNaN(parseFloat(cmd.amount)) || parseFloat(cmd.amount) <= 0) throw new Error('Invalid deposit amount.');
        if (!cmd.pubkey) throw new Error('Validator BLS pubkey required (-p, --pubkey <key>).');
        if (!cmd.pubkey.match(/^[0-9a-f]{96}$/i)) throw new Error('Invalid validator BLS pubkey.');
        if (!cmd.withdrawalPubkey) throw new Error('Withdrawal BLS pubkey required (-w, --withdrawalPubkey <key>).');
        if (!cmd.withdrawalPubkey.match(/^[0-9a-f]{96}$/i)) throw new Error('Invalid withdrawal BLS pubkey.');

        // Initialise web3
        let web3 = new Web3(cmd.host);

        // Check deposit contract
        let code = await web3.eth.getCode(cmd.depositContract);
        if (code == '0x' || code == '0x0') throw new Error('Casper Deposit contract not deployed at address' + cmd.depositContract + '.');

        // Initialise contract
        let depositContract = new web3.eth.Contract(depositContractABI, cmd.depositContract);

        // Get withdrawal credentials
        let withdrawalCredentials = Buffer.concat([
            Buffer.from('00', 'hex'), // BLS_WITHDRAWAL_PREFIX_BYTE
            Buffer.from(web3.utils.sha3(cmd.withdrawalPubkey).substr(2), 'hex').slice(1) // Last 31 bytes of withdrawal pubkey hash
        ], 32);

        // Get proof of possession
        // TODO: implement correctly once hash_tree_root functionality is available in SSZ
        let proofOfPossession = Buffer.from(
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' +
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef' +
            '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
            'hex'
        );

        // Get deposit input
        let depositInput = ssz.serialize(
            {
                'pubkey': Buffer.from(cmd.pubkey, 'hex'),
                'withdrawal_credentials': withdrawalCredentials,
                'proof_of_possession': [proofOfPossession.slice(0, 48), proofOfPossession.slice(48, 96)],
            },
            {fields: {
                'pubkey': 'uint384',
                'withdrawal_credentials': 'hash32',
                'proof_of_possession': ['uint384'],
            }}
        );

        // Deposit
        await depositContract.methods.deposit(depositInput).send({
            from: cmd.from,
            value: web3.utils.toWei(cmd.amount, 'ether'),
            gas: 8000000,
        });

        // Log
        console.log('Validator deposit made successfully for ' + cmd.pubkey + '.');

    }
    catch (e) {
        console.log(e.message);
    }
}
validatorDeposit();
