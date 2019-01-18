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
        this.beaconChain.on('validator.status', (type, validator) => {
            this.broadcastValidatorStatus(type, validator);
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
     * @param type The type of validator status
     * @param validator The validator with updated status
     */
    broadcastValidatorStatus(type, validator) {
        
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
