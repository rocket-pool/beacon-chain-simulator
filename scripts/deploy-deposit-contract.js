const fs = require('fs');
const Web3 = require('web3');

// Get contract data
let depositContractABI = JSON.parse(fs.readFileSync(__dirname + '/../contracts/casper/Deposit.abi'));
let depositContractBinary = fs.readFileSync(__dirname + '/../contracts/casper/Deposit.bin');

// Initialise web3
let web3 = new Web3('http://127.0.0.1:8545');

// Deploy deposit contract
async function deployDepositContract() {

    // Get accounts
    let accounts = await web3.eth.getAccounts();

    // Initialise contract
    let depositContract = new web3.eth.Contract(depositContractABI);

    // Deploy contract
    let depositContractInstance = await depositContract.deploy({data: depositContractBinary}).send({
        from: accounts[0],
        gas: 8000000,
    });

    console.log('Casper Deposit contract deployed successfully.');
    console.log('Casper Deposit contract address: ' + depositContractInstance.options.address);

}
deployDepositContract();
