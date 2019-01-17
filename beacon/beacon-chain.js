// Deposits
const MAX_DEPOSIT = 32000000000; // gwei

// Initial values
const GENESIS_SLOT = 0;
const FAR_FUTURE_SLOT = Math.pow(2, 64) - 1;

// Time parameters
const SLOT_DURATION = 2000; // ms
const EPOCH_LENGTH = 5; // Slots
const ENTRY_EXIT_DELAY = 10; // Slots
const MIN_VALIDATOR_WITHDRAWAL_TIME = 10; // Slots


/**
 * Beacon chain service
 */
class BeaconChain {


    /**
     * Constructor
     */
    constructor() {

        // Beacon state
        this.slot = GENESIS_SLOT;
        this.genesisTime = 0;

        // Validator registry
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
            this.processDeposit(...args);
        });

        // Start beacon chain processing
        this.start();

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
            this.addValidator(pubkey, amount, withdrawalCredentials, randaoCommitment, custodyCommitment);
        }

        // Increase balance if validator exists
        else {
            this.validatorBalances[index] += amount;
        }

    }


    /**
     * =======================
     * Beacon state management
     * =======================
     */


    /**
     * Start beacon chain processing
     */
    start() {

        // Set genesis time
        this.genesisTime = Date.now();

        // Start slot processing
        this.slotTimer = setInterval(() => { this.processSlot(); }, SLOT_DURATION);

    }


    /**
     * Per-slot processing
     */
    processSlot() {

        // Set slot index
        this.slot = Math.floor((Date.now() - this.genesisTime) / SLOT_DURATION);

        // Process epochs
        if (this.slot % EPOCH_LENGTH == 0) this.processEpoch();

    }


    /**
     * Per-epoch processing
     */
    processEpoch() {

        // Logging
        console.log('Processing epoch...');
        console.log('Current slot: %d', this.slot);

        // Activate pending validators
        this.validatorRegistry.filter((v, vi) => (
            v.activationSlot > this.slot + ENTRY_EXIT_DELAY && // Pending activation
            this.validatorBalances[vi] >= MAX_DEPOSIT // Sufficient balance
        )).forEach(v => {

            // Set validator activation slot
            v.activationSlot = this.slot + ENTRY_EXIT_DELAY;

            // Log
            console.log('Activating validator %s at slot %d', v.pubkey, v.activationSlot);

        });

        // Logging
        console.log('');

    }


    /**
     * ====================
     * Validator management
     * ====================
     */


    /**
     * Find a validator's index by public key
     * @param pubkey The validator's public key
     * @return The validator's index, or -1 if not found
     */
    getValidatorIndex(pubkey) {
        return this.validatorRegistry.findIndex(v => (v.pubkey == pubkey));
    }


    /**
     * Find active validator indices
     * @return An array of active validator indices
     */
    getActiveValidatorIndices() {
        var indices = [];
        this.validatorRegistry.forEach((v, vi) => {
            if (v.activationSlot <= this.slot && v.exitSlot > this.slot) indices.push(vi);
        });
        return indices;
    }


    /**
     * Add a validator to the registry
     * @param pubkey The validator's public key
     * @param amount The validator's deposit amount in gwei
     * @param withdrawalCredentials The validator's withdrawal credentials
     * @param randaoCommitment The validator's randao commitment
     * @param custodyCommitment The validator's custody commitment
     * @return The index of the new validator
     */
    addValidator(pubkey, amount, withdrawalCredentials, randaoCommitment, custodyCommitment) {

        // Log
        console.log('Adding validator %s with balance %d at index %d', pubkey, amount, this.validatorRegistry.length);
        console.log('');

        // Add validator
        this.validatorRegistry.push({
            pubkey,
            withdrawalCredentials,
            randaoCommitment,
            custodyCommitment,
            activationSlot: FAR_FUTURE_SLOT,
            exitSlot: FAR_FUTURE_SLOT,
            withdrawalSlot: FAR_FUTURE_SLOT,
            penalizedSlot: FAR_FUTURE_SLOT,
        });
        return this.validatorBalances.push(amount) - 1;

    }


}


// Exports
module.exports = BeaconChain;
