#!/usr/bin/env tsx
/* eslint-disable import/no-extraneous-dependencies -- dev deps are ok here */
import { createContext, createRootPinoLogger, Logger } from '@diager-js/core';
import { randomUUID } from 'crypto';
import express, { ErrorRequestHandler, Request, Response } from 'express';
import pino from 'pino';
import { createServer, RequestListener } from 'http';
import { createDiagMiddleware } from '../src/middleware/diag.js';
import { createAccessLogMiddleware } from '../src/middleware/access-log.js';

/**
 * This example demonstrate usage of diag middleware in combination with logger and diag context.
 * Please setup project as per README.md before running this example.
 * To run the example, execute the following command:
 * ./packages/express/examples/basic.ts | pino-pretty
 *
 * Run the below in a separate terminal. You should see logs with info level only.
 * curl localhost:3000/pets
 *
 * Run the below in a separate terminal. You should see logs with debug level as well.
 * curl localhost:3000/pets --header "X-Log-Level: debug"
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
  getPets(req: Request, res: Response): void;
}

function createPetsController(deps: {
  rootLogger: Logger;
}): PetsController {
  const logger = deps.rootLogger.withGroup('pets-controller');
  return {
    getPets(_, res) {
      logger.info('Getting pets');
      const pets = [
        { name: 'Fluffy', species: 'cat', age: 2 },
        { name: 'Fido', species: 'dog', age: 1 },
        { name: 'Sassy', species: 'cat', age: 2 },
      ];
      logger.debug(`Will return ${pets.length} pets`);
      res.send(pets);
    },
  };
}

function setupExpress() {
  const diagCtx = createContext({ correlationId: randomUUID() });
  const rootLogger = createRootPinoLogger({
    context: diagCtx,
    pinoLogger: pino({ level: 'info' }), // doing info to demonstrate X-Log-Level
  });

  const petsController = createPetsController({ rootLogger });

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
  srv.listen(3000, () => {
    logger.info('Server is listening on http://localhost:3000/');
  });
}

const app = setupExpress();
startListener({ listener: app.listener, logger: app.rootLogger });
