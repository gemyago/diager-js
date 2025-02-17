# diager-js
Toolbox to streamline logging, tracing, and debugging in Node.js backend apps

## Overview

The toolbox includes a tiny set of components and middleware to help you standardize logging, tracing, and debugging in your Node.js backend apps. The toolbox also allows dynamic log level changes in scope of individual requests, which is useful for debugging in production.

Please see example usage in the [examples](packages/examples/src) folder.
The [axios-server-to-server](packages/examples/src/axios-server-to-server.ts) is the most advanced example, showing a server to server communication that is the most typical in microservices architecture.

## Contributing

Please have [direnv](https://github.com/direnv/direnv) and [nvm](https://github.com/nvm-sh/nvm#installing-and-updating) installed. You may need to do `nvm install` once to have a required Node.js version installed.

To get started, run:

```bash
# may need to do this once
# make sure no errors
direanv allow

# Install dependencies
npm i

# Build the project
make dist

# Run lint and tests
make lint
make test
```
