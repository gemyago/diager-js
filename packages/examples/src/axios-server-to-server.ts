#!/usr/bin/env tsx
/* eslint-disable import/no-extraneous-dependencies -- dev deps are ok here */
import { createContext, createRootPinoLogger, Logger } from '@diager-js/core';
import { randomUUID } from 'crypto';
import express, { ErrorRequestHandler, Request, Response } from 'express';
import pino from 'pino';
import { createServer, RequestListener } from 'http';
import { createAccessLogMiddleware, createDiagMiddleware } from '@diager-js/express/middleware';
import axios, { Axios } from 'axios';
import { createAxiosClientLogInterceptors, formatProducerUserAgent } from '@diager-js/axios';

/**
 * This example demonstrates usage of axios client log interceptors in a server to server scenario.
 * This is a most typical use-case in a microservices architecture.
 *
 * The example includes a "get /pets" route that will fetch pets from `express-basic`
 * example endpoint.
 *
 * Please setup project as per README.md before running this example.
 * Start express-basic example first:
 * ./packages/examples/src/express-basic.ts | pino-pretty
 *
 * To run the example, execute the following command:
 * ./packages/examples/src/axios-server-to-server.ts | pino-pretty
 *
 * Run the below in a separate terminal. You should see logs with info level only on the server.
 * curl localhost:3001/pets
 *
 * Run the below in a separate terminal. You should see logs with debug level as well propagated
 * across all the services.
 * curl localhost:3001/pets --header "X-Log-Level: debug"
 *
 * You should also see a consistent correlationId with each log message.
 */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler : ErrorRequestHandler = (err, req, res, next) => {
  res.status(500).send({
    error: err.message,
    stack: err.stack,
  });
};

type PetsController = {
  getPets(req: Request, res: Response): Promise<void>;
}

function createPetsController(deps: {
  rootLogger: Logger;
  axiosInstance: Axios
}): PetsController {
  const logger = deps.rootLogger.withGroup('pets-controller');
  const { axiosInstance } = deps;
  return {
    async getPets(_, res) {
      logger.info('Getting pets from pets service');
      const petsRes = await axiosInstance.get('http://localhost:3000/pets');
      logger.debug(`Will return ${petsRes.data.length} pets`);
      res.send(petsRes.data);
    },
  };
}

function setupExpress() {
  const diagCtx = createContext({ correlationId: randomUUID() });
  const rootLogger = createRootPinoLogger({
    context: diagCtx,
    pinoLogger: pino.pino({ level: 'info' }), // doing info to demonstrate X-Log-Level
  });

  const axiosInstance = axios.create();

  createAxiosClientLogInterceptors({
    userAgent: formatProducerUserAgent({
      name: '@diager-js/examples',
      version: '0.0.1',
      meta: { example: 'axios-server-to-server' },
    }),
    context: diagCtx,
    logger: rootLogger.withGroup('axios'),
  }).attachTo(axiosInstance);

  const petsController = createPetsController({ rootLogger, axiosInstance });

  const expressApp = express();
  expressApp.use(createDiagMiddleware({ context: diagCtx }));
  expressApp.use(createAccessLogMiddleware({ logger: rootLogger.withGroup('access-logs') }));
  expressApp.get('/pets', petsController.getPets);
  expressApp.use(errorHandler);
  return { listener: expressApp, rootLogger };
}

function startListener(params: { listener: RequestListener, logger: Logger }) {
  const { listener, logger } = params;
  const srv = createServer(listener);
  srv.listen(3001, () => {
    logger.info('Server is listening on http://localhost:3001/');
  });
}

const app = setupExpress();
startListener({ listener: app.listener, logger: app.rootLogger });
