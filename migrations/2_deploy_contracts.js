const fs = require('fs');
const Web3 = require('web3');
const config = require('../truffle-config.js');

// Contracts
const Withdraw = artifacts.require('./Withdraw.sol');

// Deposit contract data
const depositContractABI = JSON.parse(fs.readFileSync(__dirname + '/../contracts/casper/Deposit.abi'));
const depositContractBinary = fs.readFileSync(__dirname + '/../contracts/casper/Deposit.bin');

// Deployment
module.exports = async (deployer, network, accounts) => {

    // Initialise web3
    let net = config.networks[network];
    let web3 = new Web3('http://' + net.host + ':' + net.port);

    // Initialise deposit contract
    let depositContract = new web3.eth.Contract(depositContractABI);

    // Deploy deposit contract
    let depositContractInstance = await depositContract.deploy({data: depositContractBinary}).send({
        from: net.from,
        gas: net.gas,
    });

    // Deploy withdrawal contract
    await deployer.deploy(Withdraw);

    // Seed withdrawal contract
    if (network == 'development') {

        // Get withdrawal contract
        let withdraw = await Withdraw.deployed();

        // Get from address & balance
        let from = accounts[accounts.length - 1];
        let balance = await web3.eth.getBalance(from);

        // Send ether
        await web3.eth.sendTransaction({
            from: from,
            to: withdraw.address,
            value: web3.utils.toWei('32000', 'ether'),
            gas: net.gas,
        });

    }

};
