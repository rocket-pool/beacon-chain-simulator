const EventEmitter = require('events');


// Deposits
const DEPOSIT_SIZE = 32000000000; // gwei
const EJECTION_BALANCE = 16000000000; // gwei

// Initial values
const GENESIS_SLOT = 0;
const FAR_FUTURE_SLOT = Math.pow(2, 64) - 1;

// Time parameters
const SLOT_DURATION = 2000; // ms
const EPOCH_LENGTH = 5; // Slots
const ENTRY_EXIT_DELAY = 10; // Slots
const VALIDATOR_WITHDRAWAL_TIME = 10; // Slots

// Status flags
const INITIATED_EXIT = 1;


/**
 * Beacon chain service
 */
class BeaconChain extends EventEmitter {


    /**
     * Constructor
     */
    constructor() {
        super();

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
     * ==================
     * External interface
     * ==================
     */


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
            console.log('Added validator %s with balance %d at index %d', pubkey, amount, this.validatorRegistry.length);
        }

        // Increase balance if validator exists
        else {
            this.increaseValidatorBalance(index, amount);
            console.log('Increased balance of validator %s by %d to %d', pubkey, amount, this.validatorBalances[index]);
        }

    }


    /**
     * Request a validator exit
     * @param pubkey The public key of the validator to exit
     * @return true on success or false on failure
     */
    requestValidatorExit(pubkey) {

        // Get validator index
        let index = this.getValidatorIndex(pubkey);
        if (index == -1) return false;

        // Check validator state
        let validator = this.validatorRegistry[index];
        if (validator.exitSlot <= this.slot + ENTRY_EXIT_DELAY) return false; // Already exited
        if (validator.statusFlags & INITIATED_EXIT) return false; // Already initiated

        // TODO: verify BLS signature when implemented

        // Initiate exit
        this.initiateValidatorExit(index);
        return true;

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

        // Emit validator events
        this.validatorRegistry.forEach((v, vi) => {
            if (v.activationSlot == this.slot) this.emit('validator.status', 'activated', v);
            if (v.exitSlot == this.slot) this.emit('validator.status', 'exited', v);
            if (v.exitSlot == this.slot - VALIDATOR_WITHDRAWAL_TIME) this.emit('validator.status', 'withdrawable', v);
            if (v.withdrawalSlot == this.slot) this.emit('validator.status', 'withdrawn', v);
        });

    }


    /**
     * Per-epoch processing
     */
    processEpoch() {

        // Logging
        console.log('Processing epoch...');
        console.log('  '+'Current slot: %d', this.slot);

        // Process validators
        this.validatorRegistry.forEach((v, vi) => {

            // Activate pending validators
            if (
                v.activationSlot > this.slot + ENTRY_EXIT_DELAY && // Pending activation
                this.validatorBalances[vi] >= DEPOSIT_SIZE // Sufficient balance
            ) {
                this.activateValidator(vi);
                console.log('  '+'Activating validator %s with balance %d at slot %d', v.pubkey, this.validatorBalances[vi], v.activationSlot);
            }

            // Exit pending validators
            if (
                v.exitSlot > this.slot + ENTRY_EXIT_DELAY && // Not exited
                v.statusFlags & INITIATED_EXIT // Initiated exit
            ) {
                this.exitValidator(vi);
                console.log('  '+'Exiting validator %s with balance %d at slot %d', v.pubkey, this.validatorBalances[vi], v.exitSlot);
            }

            // Eject validators with insufficient balances
            if (
                v.activationSlot <= this.slot && v.exitSlot > this.slot + ENTRY_EXIT_DELAY && // Active & not exited
                this.validatorBalances[vi] < EJECTION_BALANCE // Insufficient balance
            ) {
                this.exitValidator(vi);
                console.log('  '+'Ejecting validator %s with balance %d at slot %d', v.pubkey, this.validatorBalances[vi], v.exitSlot);
            }

        });

        // Logging
        console.log('Processing complete.');

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
        this.validatorRegistry.push({
            pubkey,
            withdrawalCredentials,
            randaoCommitment,
            custodyCommitment,
            activationSlot: FAR_FUTURE_SLOT,
            exitSlot: FAR_FUTURE_SLOT,
            withdrawalSlot: FAR_FUTURE_SLOT,
            statusFlags: 0,
        });
        return this.validatorBalances.push(amount) - 1;
    }


    /**
     * Increase a validator's balance
     * @param index The index of the validator to update
     * @param amount The amount to increase the balance by
     */
    increaseValidatorBalance(index, amount) {
        this.validatorBalances[index] += amount;
    }


    /**
     * Initiate validator exit
     * @param index The index of the validator to exit
     */
    initiateValidatorExit(index) {
        this.validatorRegistry[index].statusFlags |= INITIATED_EXIT;
    }


    /**
     * Activate a validator
     * @param index The index of the validator to activate
     */
    activateValidator(index) {
        this.validatorRegistry[index].activationSlot = this.slot + ENTRY_EXIT_DELAY;
    }


    /**
     * Exit a validator
     * @param index The index of the validator to exit
     */
    exitValidator(index) {
        this.validatorRegistry[index].exitSlot = this.slot + ENTRY_EXIT_DELAY;
    }


}


// Exports
module.exports = BeaconChain;
