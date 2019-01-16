const fs = require('fs');
const cmd = require('commander');
const Web3 = require('web3');

// Default web3 host
const defaultWeb3Host = 'http://127.0.0.1:8545';

// Get contract data
const depositContractABI = JSON.parse(fs.readFileSync(__dirname + '/../contracts/casper/Deposit.abi'));
const depositContractBinary = fs.readFileSync(__dirname + '/../contracts/casper/Deposit.bin');

// Initialise CLI
cmd
    .option('-h, --host <address>', 'The address of the web3 host')
    .option('-f, --from <address>', 'The address to deploy the Casper Deposit contract from')
    .parse(process.argv);

// Deploy deposit contract
async function deployDepositContract() {
    try {

        // Process CLI arguments
        if (!cmd.host) { cmd.host = defaultWeb3Host; }
        if (!cmd.from) { throw new Error('You must specify a from address (-f, --from).'); }
        if (!cmd.from.match(/^(0x)?[0-9a-f]{40}$/i)) { throw new Error('Invalid from address.'); }

        // Initialise web3
        let web3 = new Web3(cmd.host);

        // Initialise contract
        let depositContract = new web3.eth.Contract(depositContractABI);

        // Deploy contract
        let depositContractInstance = await depositContract.deploy({data: depositContractBinary}).send({
            from: cmd.from,
            gas: 8000000,
        });

        // Log
        console.log('Casper Deposit contract deployed successfully.');
        console.log('Casper Deposit contract address: ' + depositContractInstance.options.address);

    }
    catch (e) {
        console.log(e.message);
    }
}
deployDepositContract();
