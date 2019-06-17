# Start from node 10 image
FROM node:10

# Copy source files
ADD ./beacon /beacon-chain-simulator/beacon
ADD ./contracts /beacon-chain-simulator/contracts
ADD ./package.json /beacon-chain-simulator/package.json
ADD ./package-lock.json /beacon-chain-simulator/package-lock.json

# Install node dependencies
WORKDIR /beacon-chain-simulator
RUN npm ci

# Container entry point
ENTRYPOINT ["node", "/beacon-chain-simulator/beacon/index.js"]
