const cmd = require('commander');
const WebSocket = require('ws');

// Default beacon chain host
const DEFAULT_BEACON_HOST = 'http://127.0.0.1:8555';

// Initialise CLI
cmd
    .option('-h, --host <address>', 'The address of the beacon chain host')
    .option('-p, --pubkey <key>', 'The public BLS key for the validator')
    .parse(process.argv);

// Send validator exit message
async function validatorExit() {
    try {

        // Process CLI arguments
        if (!cmd.host) cmd.host = DEFAULT_BEACON_HOST;
        if (!cmd.pubkey) throw new Error('Validator BLS pubkey required (-p, --pubkey <key>).');
        if (!cmd.pubkey.match(/^[0-9a-f]{96}$/i)) throw new Error('Invalid validator BLS pubkey.');

        // Initialise websocket connection
        let ws = new WebSocket(cmd.host);

        // Send exit message on connection open
        // TODO: replace public key with signature
        ws.on('open', () => {
            ws.send(JSON.stringify({
                message: 'exit',
                pubkey: cmd.pubkey,
            }));
        });

        // Handle server messages
        ws.on('message', (payload) => {
            try {
                let data = JSON.parse(payload);
                switch (data.message) {

                    // Success
                    case 'success':
                        console.log('Validator exited successfully');
                    break;

                    // Error
                    case 'error':
                        console.log('A server error occurred:', data.error);
                    break;

                    // Unknown
                    default:
                        console.log('Unknown server response:', data);
                    break;

                }
            }
            catch (e) {
                console.log('Invalid server response:', e.message);
            }
            ws.close();
        });

    }
    catch (e) {
        console.log(e.message);
    }
}
validatorExit();
