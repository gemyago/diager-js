import express, { Application, ErrorRequestHandler, RequestHandler } from 'express';
import { createContext } from '@diager-js/core';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { createDiagMiddleware } from '../../src/middleware/diag.js';

describe('diag-middleware', () => {
  // has to have 4 arguments
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const errorHandler : ErrorRequestHandler = (err, req, res, next) => {
    expect(err).toBeNull();
    res.status(500).send({
      error: err.message,
      stack: err.stack,
    });
  };

  const createApp = (opts: {
    middleware: RequestHandler,
    mountRoutes: (app: Application) => void
  }) => {
    const app = express();
    app.use(opts.middleware);
    opts.mountRoutes(app);
    app.use(errorHandler);
    return app;
  };

  it('should process the request and delegate to next', async () => {
    const context = createContext({ correlationId: randomUUID() });
    let handlerCalled = false;
    const app = createApp({
      middleware: createDiagMiddleware({ context }),
      mountRoutes: (a) => {
        a.get('/something', (req, res) => {
          handlerCalled = true;
          res.status(200);
        });
      },
    });
    const res = await supertest(app).get('/something');
    expect(res.status).toEqual(200);
    expect(handlerCalled).toEqual(true);
  });
});
