/**
 * Beacon chain validator registry
 */
class ValidatorRegistry {


    /**
     * Constructor
     */
    constructor() {

        // Validator data
        this.validatorRegistry = [];
        this.validatorBalances = [];

    }


    /**
     * Initialise
     * @param cmd Application commands
     * @param powChain PoW chain service
     */
    init(cmd, powChain) {

        // Process PoW chain deposits
        powChain.on('deposit', (...args) => {
            this.processDeposit.apply(this, args);
        });

    }


    /**
     * Process a PoW chain deposit
     * @param pubkey The validator's public key
     * @param amount The validator's deposit amount in gwei
     * @param proofOfPossession The validator's proof of possession
     * @param withdrawalCredentials The validator's withdrawal credentials
     * @param randaoCommitment The validator's randao commitment
     * @param custodyCommitment The validator's custody commitment
     */
    processDeposit(pubkey, amount, proofOfPossession, withdrawalCredentials, randaoCommitment, custodyCommitment) {

        // Validate proof of possession
        // TODO: validate once implemented

        // Check for existing validator
        let index = this.getValidatorIndex(pubkey);

        // Add validator if it doesn't exist
        if (index == -1) {
            this.addValidator(pubkey, withdrawalCredentials, randaoCommitment, custodyCommitment, amount);
        }

        // Increase balance if validator exists
        else {
            this.validatorBalances[index] += amount;
        }

    }


    /**
     * Find a validator's index by public key
     * @param pubkey The validator's public key
     * @return The validator's index, or -1 if not found
     */
    getValidatorIndex(pubkey) {
        return this.validatorRegistry.findIndex(v => (v.pubkey == pubkey));
    }


    /**
     * Add a validator to the registry
     * @param pubkey The validator's public key
     * @param withdrawalCredentials The validator's withdrawal credentials
     * @param randaoCommitment The validator's randao commitment
     * @param custodyCommitment The validator's custody commitment
     * @param amount The validator's deposit amount in gwei
     * @return The index of the new validator
     */
    addValidator(pubkey, withdrawalCredentials, randaoCommitment, custodyCommitment, amount) {
        this.validatorRegistry.push({
            pubkey,
            withdrawalCredentials,
            randaoCommitment,
            custodyCommitment,
        });
        return this.validatorBalances.push(amount) - 1;
    }


}


// Exports
module.exports = ValidatorRegistry;
