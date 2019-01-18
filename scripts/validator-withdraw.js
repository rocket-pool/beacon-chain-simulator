const cmd = require('commander');
const WebSocket = require('ws');

// Default beacon chain host
const DEFAULT_BEACON_HOST = 'http://127.0.0.1:8555';

// Initialise CLI
cmd
    .option('-h, --host <address>', 'The address of the beacon chain host')
    .option('-p, --pubkey <key>', 'The public BLS key for the validator')
    .parse(process.argv);

// Withdraw validator
async function validatorWithdraw() {
    try {

        // Process CLI arguments
        if (!cmd.host) cmd.host = DEFAULT_BEACON_HOST;
        if (!cmd.pubkey) throw new Error('Validator BLS pubkey required (-p, --pubkey <key>).');
        if (!cmd.pubkey.match(/^[0-9a-f]{96}$/i)) throw new Error('Invalid validator BLS pubkey.');

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
                        switch (data.status) {

                            // Inactive
                            case 'inactive':
                                console.log('Validator is inactive, waiting until active...');
                            break;

                            // Active
                            case 'active':
                                console.log('Validator is active, exiting...');
                                ws.send(JSON.stringify({
                                    message: 'exit',
                                    pubkey: cmd.pubkey, // TODO: replace public key with signature
                                }));
                            break;

                            // Exiting
                            case 'exiting':
                                console.log('Validator is exiting...');
                            break;

                            // Exited
                            case 'exited':
                                console.log('Validator has exited, waiting until withdrawable...');
                            break;

                            // Withdrawable
                            case 'withdrawable':
                                console.log('Validator is withdrawable, withdrawing...');
                                ws.send(JSON.stringify({
                                    message: 'withdraw',
                                    pubkey: cmd.pubkey, // TODO: replace public key with signature
                                }));
                            break;

                            // Withdrawing
                            case 'withdrawing':
                                console.log('Validator is withdrawing...');
                            break;

                            // Withdrawn
                            case 'withdrawn':
                                console.log('Validator withdrew successfully');
                                ws.close();
                            break;

                        }
                    break;

                    // Success response
                    case 'success':
                        switch (data.action) {
                            case 'initiate_exit': console.log('Validator initiated exit successfully...'); break;
                            case 'initiate_withdrawal': console.log('Validator initiated withdrawal successfully...'); break;
                        }
                    break;

                    // Error
                    case 'error':
                        console.log('A server error occurred:', data.error);
                        ws.close();
                    break;

                    // Unknown
                    default:
                        console.log('Unknown server response:', data);
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
validatorWithdraw();
