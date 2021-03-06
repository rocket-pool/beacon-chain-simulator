const cmd = require('commander');
const WebSocket = require('ws');

// Default beacon chain host
const DEFAULT_BEACON_HOST = 'http://127.0.0.1:9545';

// Initialise CLI
cmd
    .option('-h, --host <address>', 'The address of the beacon chain host')
    .option('-p, --pubkey <key>', 'The public BLS key for the validator')
    .option('-t, --toAddress <address>', 'The address to withdraw the deposit to')
    .parse(process.argv);

// Withdraw validator
function validatorWithdraw() {
    try {

        // Process CLI arguments
        if (!cmd.host) cmd.host = DEFAULT_BEACON_HOST;
        if (!cmd.pubkey) throw new Error('Validator BLS pubkey required (-p, --pubkey <key>).');
        if (!cmd.pubkey.match(/^[0-9a-f]{96}$/i)) throw new Error('Invalid validator BLS pubkey.');
        if (!cmd.toAddress) throw new Error('To address required (-t, --toAddress <address>).');
        if (!cmd.toAddress.match(/^(0x)?[0-9a-f]{40}$/i)) throw new Error('Invalid to address.');

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

                            // Not exited
                            case 'inactive':
                            case 'active':
                                if (data.status.initiated.exit) {
                                    console.log('Validator is exiting...');
                                    break;
                                }
                                console.log('Validator has not exited, exiting...');
                                ws.send(JSON.stringify({
                                    message: 'exit',
                                    pubkey: cmd.pubkey, // TODO: replace public key with signature
                                }));
                            break;

                            // Exited
                            case 'exited':
                                console.log('Validator has exited, waiting until withdrawable...');
                            break;

                            // Withdrawable
                            case 'withdrawable':
                                if (data.status.initiated.withdrawal) {
                                    console.log('Validator is withdrawing...');
                                    break;
                                }
                                console.log('Validator is withdrawable, withdrawing...');
                                ws.send(JSON.stringify({
                                    message: 'withdraw',
                                    pubkey: cmd.pubkey, // TODO: replace public key with signature
                                    toAddress: cmd.toAddress,
                                }));
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
