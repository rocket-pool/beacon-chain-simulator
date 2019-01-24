const EventEmitter = require('events');


// Deposits
const DEPOSIT_SIZE = 32000000000; // gwei
const EJECTION_BALANCE = 16000000000; // gwei

// Initial values
const GENESIS_SLOT = 0;
const FAR_FUTURE_SLOT = Math.pow(2, 64) - 1;

// Time parameters
const SLOT_DURATION = 1000; // ms
const EPOCH_LENGTH = 5; // Slots
const ENTRY_EXIT_DELAY = 10; // Slots
const VALIDATOR_WITHDRAWAL_TIME = 10; // Slots

// Status flags
const INITIATED_EXIT = 1;
const INITIATED_WITHDRAWAL = 2;

// Rewards and penalties
const ACTIVITY_REWARD_QUOTIENT = 512;
const INACTIVITY_PENALTY_QUOTIENT = 512;


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
        this.genesisTime = 0;
        this.slot = GENESIS_SLOT;

        // Validator registry
        this.validatorRegistry = [];
        this.validatorBalances = [];

        // Validator activity log
        this.validatorActivity = [];

    }


    /**
     * Initialise
     * @param cmd Application commands
     * @param db Database service
     * @param powChain PoW chain service
     */
    init(cmd, db, powChain) {

        // Initialise params
        this.db = db;

        // Initialise validator registry from db state
        if (this.db) {
            this.validatorRegistry = this.db.get('validatorRegistry').value().slice();
            this.validatorBalances = this.db.get('validatorBalances').value().slice();
        }

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
     * Beacon chain database schema
     */
    getSchema() {
        return  {
            genesisTime: 0,
            validatorRegistry: [],
            validatorBalances: [],
        };
    }


    /**
     * Process a PoW chain deposit
     * @param pubkey The validator's public key
     * @param amount The validator's deposit amount in gwei
     * @param proofOfPossession The validator's proof of possession
     * @param withdrawalCredentials The validator's withdrawal credentials
     */
    processDeposit(pubkey, amount, proofOfPossession, withdrawalCredentials) {

        // Validate proof of possession
        // TODO: validate once implemented

        // Check for existing validator
        let index = this.getValidatorIndex(pubkey);

        // Add validator if it doesn't exist
        if (index == -1) {
            let i = this.addValidator(pubkey, amount, withdrawalCredentials);
            console.log('Added validator %s with balance %d at index %d', pubkey, amount, i);
        }

        // Increase balance if validator exists
        else {
            this.increaseValidatorBalance(index, amount);
            console.log('Increased balance of validator %s by %d to %d', pubkey, amount, this.validatorBalances[index]);
        }

    }


    /**
     * Get a validator's status
     * @param The public key of the validator
     * @return The validator's status or false if not found
     */
    getValidatorStatus(pubkey) {

        // Get validator index
        let index = this.getValidatorIndex(pubkey);
        if (index == -1) return false;

        // Get status
        let status;
        let validator = this.validatorRegistry[index];
        if (validator.withdrawalSlot <= this.slot) status = 'withdrawn';
        else if (validator.exitSlot <= this.slot - VALIDATOR_WITHDRAWAL_TIME) status = 'withdrawable';
        else if (validator.exitSlot <= this.slot) status = 'exited';
        else if (validator.activationSlot <= this.slot) status = 'active';
        else status = 'inactive';

        // Return status
        return {
            code: status,
            initiated: {
                exit: validator.statusFlags & INITIATED_EXIT,
                withdrawal: validator.statusFlags & INITIATED_WITHDRAWAL,
            },
        };

    }


    /**
     * Process validator activity
     * @param pubkey The public key of the validator to process activity for
     * @return true on success or false on failure
     */
    processValidatorActivity(pubkey) {

        // Get validator index
        let index = this.getValidatorIndex(pubkey);
        if (index == -1) return false;

        // Check validator status
        let validator = this.validatorRegistry[index];
        if (validator.activationSlot > this.slot || validator.exitSlot <= this.slot) return false; // Not active

        // TODO: verify BLS signature when implemented

        // Record activity
        this.validatorActivity.push(pubkey);
        return true;

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
     * Request a validator withdrawal
     * @param pubkey The public key of the validator to withdraw
     * @param toAddress The address to withdraw the deposit to
     * @return true on success or false on failure
     */
    requestValidatorWithdrawal(pubkey, toAddress) {

        // Get validator index
        let index = this.getValidatorIndex(pubkey);
        if (index == -1) return false;

        // Check to address
        if (!toAddress.match(/^(0x)?[0-9a-f]{40}$/i)) return false; // Invalid to address

        // Check validator state
        let validator = this.validatorRegistry[index];
        if (validator.exitSlot > this.slot - VALIDATOR_WITHDRAWAL_TIME) return false; // Not withdrawable
        if (validator.withdrawalSlot <= this.slot) return false; // Already withdrawn
        if (validator.statusFlags & INITIATED_WITHDRAWAL) return false; // Already initiated

        // TODO: verify BLS signature when implemented

        // Initiate withdrawal
        this.initiateValidatorWithdrawal(index, toAddress);
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

        // Get or initialise genesis time
        if (this.db) this.genesisTime = this.db.get('genesisTime').value();
        if (!this.genesisTime) {
            this.genesisTime = Date.now();
            if (this.db) this.db.set('genesisTime', this.genesisTime).write();
        }

        // Start slot processing
        this.slotTimer = setInterval(() => { this.processSlot(); }, SLOT_DURATION);
        this.processSlot();

    }


    /**
     * Per-slot processing
     */
    processSlot() {

        // Set slot index
        this.slot = Math.floor((Date.now() - this.genesisTime) / SLOT_DURATION);

        // Process epochs
        if (this.slot % EPOCH_LENGTH == 0) this.processEpoch();

        // Emit validator status events
        this.validatorRegistry.forEach((v, vi) => {

            // Get status
            let status = null;
            if (v.withdrawalSlot == this.slot) status = 'withdrawn';
            else if (v.exitSlot == this.slot - VALIDATOR_WITHDRAWAL_TIME) status = 'withdrawable';
            else if (v.exitSlot == this.slot) status = 'exited';
            else if (v.activationSlot == this.slot) status = 'active';
            if (!status) return;

            // Emit status event
            this.emit('validator.status', {
                code: status,
                initiated: {
                    exit: v.statusFlags & INITIATED_EXIT,
                    withdrawal: v.statusFlags & INITIATED_WITHDRAWAL,
                },
            }, v, this.validatorBalances[vi]);

        });

        // Emit epoch event
        if (this.slot % EPOCH_LENGTH == 0) this.emit('epoch', Math.floor(this.slot / EPOCH_LENGTH));

    }


    /**
     * Per-epoch processing
     */
    processEpoch() {

        // Logging
        console.log('Processing epoch...');
        console.log('  '+'Current slot: %d', this.slot);

        // Process validator states
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

            // Withdraw pending validators
            if (
                v.withdrawalSlot > this.slot && // Not withdrawn
                v.statusFlags & INITIATED_WITHDRAWAL // Initiated withdrawal
            ) {
                this.withdrawValidator(vi);
                console.log('  '+'Withdrawing validator %s with balance %d at slot %d', v.pubkey, this.validatorBalances[vi], v.withdrawalSlot);
            }

        });

        // Process rewards & penalties
        this.getActiveValidatorIndices().forEach(vi => {
            let v = this.validatorRegistry[vi];

            // Apply penalties
            if (this.validatorActivity.indexOf(v.pubkey) == -1) {
                this.penaliseValidator(vi);
                console.log('  '+'Penalising validator %s for inactivity, balance reduced to %d', v.pubkey, this.validatorBalances[vi]);
            }

            // Apply rewards
            else {
                this.rewardValidator(vi);
                console.log('  '+'Rewarding validator %s for activity, balance increased to %d', v.pubkey, this.validatorBalances[vi]);
            }

        });

        // Clear validator activity log
        this.validatorActivity = [];

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
            if (v.activationSlot < this.slot && v.exitSlot > this.slot) indices.push(vi);
        });
        return indices;
    }


    /**
     * Add a validator to the registry
     * @param pubkey The validator's public key
     * @param amount The validator's deposit amount in gwei
     * @param withdrawalCredentials The validator's withdrawal credentials
     * @return The index of the new validator
     */
    addValidator(pubkey, amount, withdrawalCredentials) {

        // Create validator record
        let validator = {
            pubkey,
            withdrawalCredentials,
            activationSlot: FAR_FUTURE_SLOT,
            exitSlot: FAR_FUTURE_SLOT,
            withdrawalSlot: FAR_FUTURE_SLOT,
            statusFlags: 0,
            withdrawalAddress: null,
        };

        // Add validator
        this.validatorRegistry.push(validator);
        this.validatorBalances.push(amount);

        // Update database
        if (this.db) {
            this.db.get('validatorRegistry').push(validator).write();
            this.db.get('validatorBalances').push(amount).write();
        }

        // Return validator index
        return this.validatorRegistry.length - 1;
    }


    /**
     * Increase a validator's balance
     * @param index The index of the validator to update
     * @param amount The amount to increase the balance by
     */
    increaseValidatorBalance(index, amount) {
        this.validatorBalances[index] += amount;
        this.writeValidatorBalance(index);
    }


    /**
     * Initiate validator exit
     * @param index The index of the validator to exit
     */
    initiateValidatorExit(index) {
        this.validatorRegistry[index].statusFlags |= INITIATED_EXIT;
        this.writeValidatorRecord(index);
    }


    /**
     * Initiate validator withdrawal
     * @param index The index of the validator to withdraw
     * @param toAddress The address to withdraw the deposit to
     */
    initiateValidatorWithdrawal(index, toAddress) {
        this.validatorRegistry[index].statusFlags |= INITIATED_WITHDRAWAL;
        this.validatorRegistry[index].withdrawalAddress = toAddress;
        this.writeValidatorRecord(index);
    }


    /**
     * Activate a validator
     * @param index The index of the validator to activate
     */
    activateValidator(index) {
        this.validatorRegistry[index].activationSlot = this.slot + ENTRY_EXIT_DELAY;
        this.writeValidatorRecord(index);
    }


    /**
     * Exit a validator
     * @param index The index of the validator to exit
     */
    exitValidator(index) {
        this.validatorRegistry[index].exitSlot = this.slot + ENTRY_EXIT_DELAY;
        this.writeValidatorRecord(index);
    }


    /**
     * Withdraw a validator
     * @param index The index of the validator to withdraw
     */
    withdrawValidator(index) {
        this.validatorRegistry[index].withdrawalSlot = this.slot;
        this.writeValidatorRecord(index);
    }


    /**
     * Apply rewards to a validator
     * @param index The index of the validator to reward
     */
    rewardValidator(index) {
        let effectiveBalance = Math.min(this.validatorBalances[index], DEPOSIT_SIZE);
        this.validatorBalances[index] += Math.floor(effectiveBalance / ACTIVITY_REWARD_QUOTIENT);
        this.writeValidatorBalance(index);
    }


    /**
     * Apply penalties to a validator
     * @param index The index of the validator to penalise
     */
    penaliseValidator(index) {
        let effectiveBalance = Math.min(this.validatorBalances[index], DEPOSIT_SIZE);
        this.validatorBalances[index] -= Math.floor(effectiveBalance / INACTIVITY_PENALTY_QUOTIENT);
        this.writeValidatorBalance(index);
    }


    /**
     * Write a validator record to the database
     * @param index The index of the validator to write
     */
    writeValidatorRecord(index) {
        if (this.db) this.db.get('validatorRegistry[' + index + ']').assign(this.validatorRegistry[index]).write();
    }


    /**
     * Write a validator balance to the database
     * @param index The index of the validator to write
     */
    writeValidatorBalance(index) {
        if (this.db) this.db.set('validatorBalances[' + index + ']', this.validatorBalances[index]).write();
    }


}


// Exports
module.exports = BeaconChain;
