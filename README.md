# Beacon Chain Simulator

## About

The Beacon Chain Simulator simulates the process of registering a validator with the beacon chain, performing validation duties, and then exiting and withdrawing the validator's deposit and rewards/penalties.
It uses simplified logic and tweaked parameters to provide a faster and more streamlined experience for testing than the real beacon chain.
It also provides a websocket API for interacting with the chain directly, and has no peer-to-peer networking functionality, no internal blockchain, and no consensus.
Instead, it uses a traditional client-server architecture for communication and updating the "chain".

Key differences between the Beacon Chain Simulator and the official spec are:
* Validator deposits are processed immediately, without waiting for the Casper deposit contract `ChainStart` event
* A slot duration of 1 second and an epoch length of 5 slots
* A validator entry/exit delay and withdrawal time of 10 slots each
* Simplified proposal/attestation messaging - validators are only required to send empty "activity" messages to the API once per epoch
* Simplified reward/penalty calculations - active validators earn or lose a set percentage each epoch based on their activity record

Withdrawals are also fully implemented on the ethereum PoW chain, based on a custom, unofficial spec.
A Casper withdrawal contract is deployed to the PoW chain and preloaded with a large ether balance.
When validators are withdrawn on the beacon chain, the simulator sends a transaction to the withdrawal contract with their desired withdrawal address and balance.
The balance is sent to the withdrawal address along with all remaining gas.

## Contents

* The Beacon Chain Simulator entry point: `/beacon/index.js`
* The compiled official Casper deposit contract: `/contracts/casper/`
* The custom Casper withdrawal contract: `/contracts/Withdraw.sol`
* Helper scripts: `/scripts/`

The `validator-deposit` script is used to send a deposit to the Casper deposit contract and register a validator on the beacon chain.
The `validator-activity` process listens for new epochs on the beacon chain and sends activity messages as long as the specified validator is active.
The `validator-withdraw` script automates the process of exiting a validator from the beacon chain and withdrawing its deposit.

## Running the Beacon Chain Simulator

1. Start Ganache (or other PoW ethereum node):

`ganache-cli -l 8000000 -e 1000000 -m "tiger state promote hobby code orphan weather use copy ride insect long"`

2. Deploy Casper contracts:

`truffle migrate`

3. Start the Beacon Chain simulator:

`node beacon/index.js --depositContract 0x509f8ca318F3EACabeC9589dc7cc18b393129C9A --withdrawalContract 0x3094173298e90ff85CEDaFEcF776a63D439bc65F --from 0xe1065590b991a2d9169a34851816e7eb3df689ed`

4. Make a deposit to the Casper deposit contract:

```
node scripts/validator-deposit.js \
    --depositContract 0x509f8ca318F3EACabeC9589dc7cc18b393129C9A \
    --from 0xc46c4661dd9bd08627a38b5fcba15776ae667978 \
    --amount 32 \
    --pubkey 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd01 \
    --withdrawalPubkey 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
    --randaoCommitment 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef \
    --custodyCommitment 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef
```

5. Start the validator activity script:

`node scripts/validator-activity.js --pubkey 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd01`

6. Withdraw a validator from the beacon chain when ready:

`node scripts/validator-withdraw.js --pubkey 0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcd01 --toAddress 0x05c988f24e7c38cde516e10563860d5e68a8e5b8`
