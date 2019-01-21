const cmd = require('commander');
const WebSocket = require('ws');

// Default beacon chain host
const DEFAULT_BEACON_HOST = 'http://127.0.0.1:8555';

// Initialise CLI
cmd
    .option('-h, --host <address>', 'The address of the beacon chain host')
    .option('-p, --pubkey <key>', 'The public BLS key for the validator')
    .parse(process.argv);

// Perform validator activity
function validatorActivity() {
    try {

        // Process CLI arguments
        if (!cmd.host) cmd.host = DEFAULT_BEACON_HOST;
        if (!cmd.pubkey) throw new Error('Validator BLS pubkey required (-p, --pubkey <key>).');
        if (!cmd.pubkey.match(/^[0-9a-f]{96}$/i)) throw new Error('Invalid validator BLS pubkey.');

        // Validator active
        let active = false;

        // Initialise websocket connection
        let ws = new WebSocket(cmd.host);

        // Request validator status on connection open
        ws.on('open', () => {
            ws.send(JSON.stringify({
                message: 'get_validator_status',
                pubkey: cmd.pubkey,
            }));
        });

        // Handle server messages
        ws.on('message', (payload) => {
            try {
                let data = JSON.parse(payload);
                switch (data.message) {

                    // Validator status
                    case 'validator_status':
                        if (data.pubkey != cmd.pubkey) break;
                        switch (data.status.code) {

                            // Inactive
                            case 'inactive':
                                console.log('Validator is inactive, waiting until active...');
                                active = false;
                            break;

                            // Active
                            case 'active':
                                console.log('Validator is active, sending activity...');
                                active = true;
                            break;

                            // Exited
                            case 'exited':
                            case 'withdrawable':
                            case 'withdrawn':
                                console.log('Validator has exited, closing connection');
                                active = false;
                                ws.close();
                            break;

                        }
                    break;

                    // Epoch
                    case 'epoch':
                        if (!active) break;
                        console.log('New epoch, sending activity...');
                        ws.send(JSON.stringify({
                            message: 'activity',
                            pubkey: cmd.pubkey,
                        }));
                    break;

                    // Success response
                    case 'success':
                        switch (data.action) {
                            case 'process_activity': console.log('Processed validator activity successfully...'); break;
                        }
                    break;

                    // Error
                    case 'error':
                        console.log('A server error occurred:', data.error);
                        ws.close();
                    break;

                }
            }
            catch (e) {
                console.log('Invalid server response:', e.message);
                ws.close();
            }
        });

    }
    catch (e) {
        console.log(e.message);
    }
}
validatorActivity();
