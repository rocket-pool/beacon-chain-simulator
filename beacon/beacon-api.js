const WebSocket = require('ws');


/**
 * Beacon chain API service
 */
class BeaconAPI {


    /**
     * Initialise
     * @param cmd Application commands
     * @param beaconChain Beacon chain service
     */
    init(cmd, beaconChain) {

        // Initialise params
        this.beaconChain = beaconChain;

        // Broadcast validator status events
        this.beaconChain.on('validator.status', (status, validator) => {
            this.broadcastValidatorStatus(status, validator);
        });

        // Initialise websocket server
        this.wss = new WebSocket.Server({
            port: cmd.apiPort
        });

        // Log info when server listening
        this.wss.on('listening', () => {
            console.log('Beacon chain API listening on port %s', this.wss.options.port);
        });

        // Handle websocket connections
        this.wss.on('connection', (ws) => {

            // Process client messages
            ws.on('message', (payload) => {
                this.processClientMessage(ws, payload);
            });

        });

    }


    /**
     * Broadcast validator status
     * @param status The type of validator status
     * @param validator The validator with updated status
     */
    broadcastValidatorStatus(status, validator) {
        this.wss.clients.forEach(ws => {
            ws.send(JSON.stringify({
                message: 'validator_status',
                status: status,
                pubkey: validator.pubkey,
            }));
        });
    }


    /**
     * Process client messages
     * @param ws The websocket client
     * @param payload The message data payload
     */
    processClientMessage(ws, payload) {

        // Parse and process message
        try {
            let data = JSON.parse(payload);
            switch (data.message) {

                // Get validator status
                case 'get_validator_status':

                    // Get validator status
                    let status = this.beaconChain.getValidatorStatus(data.pubkey);
                    if (!status) throw new Error('Unable to get validator status');

                    // Send response
                    ws.send(JSON.stringify({
                        message: 'validator_status',
                        status: status,
                        pubkey: data.pubkey,
                    }));

                break;

                // Validator activity
                case 'activity':

                    // Process validator activity
                    let success = this.beaconChain.processValidatorActivity(data.pubkey);
                    if (!success) throw new Error('Unable to process validator activity');

                    // Send response
                    ws.send(JSON.stringify({
                        message: 'success',
                        action: 'process_activity',
                    }));

                break;

                // Exit
                case 'exit':

                    // Request validator exit
                    let initiatedExit = this.beaconChain.requestValidatorExit(data.pubkey);
                    if (!initiatedExit) throw new Error('Unable to initiate validator exit');

                    // Send response
                    ws.send(JSON.stringify({
                        message: 'success',
                        action: 'initiate_exit',
                    }));

                break;

                // Withdraw
                case 'withdraw':

                    // Request validator withdrawal
                    let initiatedWithdrawal = this.beaconChain.requestValidatorWithdrawal(data.pubkey);
                    if (!initiatedWithdrawal) throw new Error('Unable to initiate validator withdrawal');

                    // Send response
                    ws.send(JSON.stringify({
                        message: 'success',
                        action: 'initiate_withdrawal',
                    }));

                break;

                // Unknown
                default:
                    throw new Error('Unknown message type');
                break;

            }
        }

        // Send error response
        catch (e) {
            ws.send(JSON.stringify({
                message: 'error',
                error: e.message,
            }));
        }

    }


}


// Exports
module.exports = BeaconAPI;
