const fs = require('fs');
const ssz = require('ssz');
const Web3 = require('web3');

// Get contract data
const depositContractABI = JSON.parse(fs.readFileSync(__dirname + '/../contracts/casper/Deposit.abi'));


/**
 * PoW chain service
 */
class PowChain {


    /**
     * Initialise
     * @param cmd Application commands
     */
    init(cmd) {

        // Initialise web3
        this.web3 = new Web3(cmd.powHost);

        // Initialise deposit contract
        let depositContract = new this.web3.eth.Contract(depositContractABI, cmd.depositContract);

        // Process existing deposit contract deposit events
        depositContract.getPastEvents('Deposit', {fromBlock: 0}).then((events) => {
            events.forEach(event => { this.processDepositEvent(event); });
        });

        // Subscribe to new deposit contract deposit events
        depositContract.events.Deposit().on('data', (event) => {
            this.processDepositEvent(event);
        });

    }


    /**
     * Process deposit events
     * @param event The deposit event
     */
    processDepositEvent(event) {

        // Get deposit input
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

    }


}


// Exports
module.exports = PowChain;
