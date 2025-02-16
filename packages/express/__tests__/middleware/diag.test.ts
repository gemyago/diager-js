import express, { Application, ErrorRequestHandler, RequestHandler } from 'express';
import { ContextValues, createContext } from '@diager-js/core';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { createDiagMiddleware } from '../../src/middleware/diag.js';

describe('diag-middleware', () => {
  // has to have 4 arguments
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const errorHandler : ErrorRequestHandler = (err, req, res, next) => {
    res.status(500).send({
      error: err.message,
      stack: err.stack,
    });
  };

  function createApp(opts: {
    middleware: RequestHandler,
    mountRoutes: (app: Application) => void
  }) {
    const app = express();
    app.use(opts.middleware);
    opts.mountRoutes(app);
    app.use(errorHandler);
    return app;
  }

  type Deps = Parameters<typeof createDiagMiddleware>[0]
  function createMockDeps() {
    return {
      context: createContext({ correlationId: randomUUID() }) as Deps['context'],
      uuidFn: jest.fn(randomUUID) as NonNullable<Deps['uuidFn']>,
    };
  }

  it('should process the request and delegate to next', async () => {
    const deps = createMockDeps();
    let handlerCalled = false;
    const app = createApp({
      middleware: createDiagMiddleware(deps),
      mountRoutes: (a) => {
        a.get('/something', (req, res) => {
          handlerCalled = true;
          res.status(200).end();
        });
      },
    });
    const res = await supertest(app).get('/something');
    expect(res.status).toEqual(200);
    expect(handlerCalled).toEqual(true);
  });

  it('should generate a new correlationId', async () => {
    const wantCorrelationId = randomUUID();
    const deps = createMockDeps();
    jest.mocked(deps.uuidFn).mockReturnValueOnce(wantCorrelationId);
    let gotValues: ContextValues | undefined;
    const app = createApp({
      middleware: createDiagMiddleware(deps),
      mountRoutes: (a) => {
        a.get('/something', (req, res) => {
          gotValues = deps.context.values;
          res.status(200).end();
        });
      },
    });
    const res = await supertest(app).get('/something');
    expect(gotValues?.correlationId).toEqual(wantCorrelationId);
    expect(deps.context.values.correlationId).not.toEqual(wantCorrelationId);
    expect(res.status).toEqual(200);
    expect(deps.uuidFn).toHaveBeenCalledTimes(1);
  });
});
