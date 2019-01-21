const EventEmitter = require('events');
const fs = require('fs');
const ssz = require('ssz');
const Web3 = require('web3');

// Get contract data
const depositContractABI = JSON.parse(fs.readFileSync(__dirname + '/../contracts/casper/Deposit.abi'));
const withdrawalContractABI = JSON.parse(fs.readFileSync(__dirname + '/../build/contracts/Withdraw.json')).abi;


/**
 * PoW chain service
 */
class PowChain extends EventEmitter {


    /**
     * Initialise
     * @param cmd Application commands
     * @param beaconChain Beacon chain service
     */
    init(cmd, beaconChain) {

        // Initialise web3
        this.web3 = new Web3(cmd.powHost);

        // Initialise contracts
        this.depositContract = new this.web3.eth.Contract(depositContractABI, cmd.depositContract);
        this.withdrawalContract = new this.web3.eth.Contract(withdrawalContractABI, cmd.withdrawalContract, {from: cmd.from, gas: 8000000});

        // Process existing deposit contract deposit events
        this.depositContract.getPastEvents('Deposit', {fromBlock: 0}).then((events) => {
            events.forEach(event => { this.processDepositEvent(event); });
        });

        // Subscribe to new deposit contract deposit events
        this.depositContract.events.Deposit().on('data', (event) => {
            this.processDepositEvent(event);
        });

        // Process beacon chain withdrawal events
        beaconChain.on('validator.status', (status, validator, balance) => {
            if (status.code == 'withdrawn') this.processWithdrawalEvent(validator, balance);
        });

    }


    /**
     * Process main chain deposit events
     * @param event The deposit event
     */
    processDepositEvent(event) {

        // Get deposit data
        let depositData = Buffer.from(event.returnValues.data.substr(2), 'hex');
        let depositAmountGweiEncoded = depositData.slice(0, 8);
        let depositTimestampEncoded = depositData.slice(8, 16);
        let depositInputEncoded = depositData.slice(16);

        // Decode deposit input
        // TODO: add proof of possession field once implemented
        let depositInputData = ssz.deserialize(depositInputEncoded, 0, {fields: {
            'pubkey': 'uint384',
            'withdrawal_credentials': 'hash32',
            'randao_commitment': 'hash32',
            'custody_commitment': 'hash32',
            //'proof_of_possession': ['uint384'],
        }});
        let depositInput = {
            pubkey: this.web3.utils.numberToHex(depositInputData.deserializedData.pubkey).substr(2).padStart(96, '0'),
            withdrawal_credentials: depositInputData.deserializedData.withdrawal_credentials.toString('hex'),
            randao_commitment: depositInputData.deserializedData.randao_commitment.toString('hex'),
            custody_commitment: depositInputData.deserializedData.custody_commitment.toString('hex'),
        };

        // Decode deposit amount
        let depositAmountGwei = parseInt(depositAmountGweiEncoded.toString('hex'), 16);

        // Emit deposit event
        this.emit('deposit',
            depositInput.pubkey,
            depositAmountGwei,
            null,
            depositInput.withdrawal_credentials,
            depositInput.randao_commitment,
            depositInput.custody_commitment
        );

    }


    /**
     * Process beacon chain withdrawal events
     * @param validator The withdrawn validator
     * @param amount The amount withdrawn
     */
    async processWithdrawalEvent(validator, amount) {

        // Get initial withdrawal address balance
        let balance1 = await this.web3.eth.getBalance(validator.withdrawalAddress);

        // Send main chain withdrawal transaction
        let result = await this.withdrawalContract.methods.withdraw(validator.withdrawalAddress, this.web3.utils.toWei(''+amount, 'gwei')).send();

        // Get withdrawal address balance difference
        let balance2 = await this.web3.eth.getBalance(validator.withdrawalAddress);
        let diff = (balance2 - balance1) / 1000000000000000000;

        // Log
        console.log('Validator %s balance withdrawn to %s, address balance increased by %d ETH', validator.pubkey, validator.withdrawalAddress, diff);

    }


}


// Exports
module.exports = PowChain;
