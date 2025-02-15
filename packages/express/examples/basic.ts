#!/usr/bin/env tsx
/* eslint-disable import/no-extraneous-dependencies -- dev deps are ok here */
import { createContext, createRootPinoLogger } from '@diager-js/core';
import { randomUUID } from 'crypto';
import express, { ErrorRequestHandler } from 'express';
import pino from 'pino';
import { createDiagMiddleware } from '../src/middleware/diag.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const errorHandler : ErrorRequestHandler = (err, req, res, next) => {
  res.status(500).send({
    error: err.message,
    stack: err.stack,
  });
};

const diagCtx = createContext({ correlationId: randomUUID() });
const rootLogger = createRootPinoLogger({
  context: diagCtx,
  pinoLogger: pino.pino(),
});

const app = express();
app.use(createDiagMiddleware({ context: diagCtx }));
app.use(errorHandler);
app.get('/pets', (_, res) => {
  res.send([
    { name: 'Fluffy', species: 'cat', age: 2 },
    { name: 'Fido', species: 'dog', age: 1 },
    { name: 'Sassy', species: 'cat', age: 2 },
  ]);
});

app.listen(3000, () => {
  rootLogger.info('Server is listening on http://localhost:3000/pets');
});
