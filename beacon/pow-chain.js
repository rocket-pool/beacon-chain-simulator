const EventEmitter = require('events');
const fs = require('fs');
const ssz = require('@chainsafesystems/ssz');
const Web3 = require('web3');


// Config
const CHECK_CONNECTION_INTERVAL = 10000;


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
        this.powHost = cmd.powHost;
        this.depositContractAddress = cmd.depositContract;
        this.withdrawalContractAddress = cmd.withdrawalContract;
        this.fromAddress = cmd.from;

        // Check PoW chain connection on interval
        this.checkConnectionTimer = setInterval(() => {
            this.checkConnection();
        }, CHECK_CONNECTION_INTERVAL);
        this.checkConnection();

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
     * Check PoW chain connection
     */
    checkConnection() {

        // Initialise web3
        if (!this.web3) this.web3 = new Web3(this.powHost);

        // Get network ID
        this.web3.eth.net.getId().then(id => {

            // Initialise connection
            if (!this.connected) {
                this.connected = true;
                this.initConnection();
            }

        }).catch(e => {

            // Close connection
            if (this.connected) {
                this.connected = false;
                this.closeConnection();
            }

            // Unset web3
            this.web3 = null;

            // Log
            console.log('Lost connection to PoW provider at %s, retrying in %ds...', this.powHost, CHECK_CONNECTION_INTERVAL / 1000);

        });

    }


    /**
     * Initialise PoW chain connection
     */
    initConnection() {

        // Log
        console.log('Connected to PoW provider, initialising...');

        // Initialise contracts
        this.depositContract = new this.web3.eth.Contract(depositContractABI, this.depositContractAddress);
        this.withdrawalContract = new this.web3.eth.Contract(withdrawalContractABI, this.withdrawalContractAddress, {from: this.fromAddress, gas: 8000000});

        // Process existing deposit contract deposit events
        this.depositContract.getPastEvents('Deposit', {fromBlock: 0}).then((events) => {
            events.forEach(event => { this.processDepositEvent(event); });
        });

        // Subscribe to new deposit contract deposit events
        this.depositSubscription = this.depositContract.events.Deposit().on('data', (event) => {
            this.processDepositEvent(event);
        });

    }


    /**
     * Close PoW chain connection
     */
    closeConnection() {

        // Log
        console.log('Lost connection to PoW provider, closing...');

        // Unsubscribe from contract events
        this.depositSubscription.unsubscribe();

        // Unset contracts
        this.depositContract = null;
        this.withdrawalContract = null;

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

        // Check connection
        if (!this.connected) return;

        // Send main chain withdrawal transaction
        let result = await this.withdrawalContract.methods.withdraw(validator.withdrawalAddress, this.web3.utils.toWei(''+amount, 'gwei')).send();

        // Log
        let ethAmount = this.web3.utils.fromWei(result.events.Withdrawal.returnValues.amount, 'ether');
        console.log('Validator %s balance of %d ETH withdrawn to %s', validator.pubkey, ethAmount, validator.withdrawalAddress);

    }


}


// Exports
module.exports = PowChain;
