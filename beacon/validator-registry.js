/**
 * Beacon chain validator registry
 */
class ValidatorRegistry {


    /**
     * Initialise
     * @param cmd Application commands
     * @param powChain PoW chain service
     */
    init(cmd, powChain) {

        // Process PoW chain deposits
        powChain.on('deposit', this.processDeposit);

    }


    /**
     * process a PoW chain deposit
     * @param depositInput The validator deposit input
     * @param depositAmount The validator deposit amount in gwei
     */
    processDeposit(depositInput, depositAmount) {
        
    }


}


// Exports
module.exports = ValidatorRegistry;
