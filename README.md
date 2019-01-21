#Beacon Chain Simulator

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
