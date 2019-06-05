const EventEmitter = require('events');
const fs = require('fs');
const ssz = require('@chainsafesystems/ssz');
const Web3 = require('web3');


// Get contract data
const depositContractABI = JSON.parse(fs.readFileSync(__dirname + '/../contracts/casper/Deposit.abi'));
const withdrawalContractABI = JSON.parse(fs.readFileSync(__dirname + '/../contracts/compiled/Withdraw.abi'));


/**
 * PoW chain service
 */
class PowChain extends EventEmitter {


    /**
     * Initialise
     * @param cmd Application commands
     * @param db Database service
     * @param beaconChain Beacon chain service
     */
    init(cmd, db, beaconChain) {

        // Initialise params
        this.db = db;

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
     * PoW chain database schema
     */
    getSchema() {
        return {
            processedDepositEvents: [],
        };
    }


    /**
     * Process main chain deposit events
     * @param event The deposit event
     */
    processDepositEvent(event) {

        // Check and cache event processed status
        if (this.db) {
            let processedEvent = this.db.get('processedDepositEvents').find({id: event.id}).value();
            if (processedEvent) return;
            this.db.get('processedDepositEvents').push({id: event.id}).write();
        }

        // Get deposit amount
        let amountGwei = parseInt(Buffer.from(event.returnValues.amount.substr(2), 'hex').swap64().toString('hex'), 16);

        // Emit deposit event
        this.emit('deposit',
            event.returnValues.pubkey.substr(2),
            event.returnValues.withdrawal_credentials.substr(2),
            amountGwei,
            event.returnValues.signature.substr(2)
        );

    }


    /**
     * Process beacon chain withdrawal events
     * @param validator The withdrawn validator
     * @param amount The amount withdrawn
     */
    async processWithdrawalEvent(validator, amount) {

        // Send main chain withdrawal transaction
        let result = await this.withdrawalContract.methods.withdraw(validator.withdrawalAddress, this.web3.utils.toWei(''+amount, 'gwei')).send();

        // Log
        let ethAmount = this.web3.utils.fromWei(result.events.Withdrawal.returnValues.amount, 'ether');
        console.log('Validator %s balance of %d ETH withdrawn to %s', validator.pubkey, ethAmount, validator.withdrawalAddress);

    }


}


// Exports
module.exports = PowChain;
