module.exports = {
    networks: {
        development: {
            host: "127.0.0.1",
            port: 8545,
            network_id: "*",
            gas: 8000000,
            from: '0xe1065590b991a2d9169a34851816e7eb3df689ed',
        },
    },
    mocha: {},
    compilers: {
        solc: {},
    },
};
