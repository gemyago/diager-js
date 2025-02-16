import express, { Application, ErrorRequestHandler, RequestHandler } from 'express';
import { ContextValues, createContext, LogLevel } from '@diager-js/core';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { faker } from '@faker-js/faker';
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

  type Deps<TContextValues extends ContextValues> = Parameters<
    typeof createDiagMiddleware<TContextValues>
  >[0]
  function createMockDeps<TContextValues extends ContextValues>() {
    return {
      context: createContext({ correlationId: randomUUID() }) as Deps<TContextValues>['context'],
      uuidFn: jest.fn(randomUUID) as NonNullable<Deps<TContextValues>['uuidFn']>,
    };
  }

  async function sendRequest<TContextValues extends ContextValues>(params: {
    deps: Deps<TContextValues>,
    middleware: RequestHandler,
    onRequest?: (req: supertest.Test) => void,
  }) {
    const { deps, middleware } = params;
    let handlerCalled = false;
    let handlerContextValues: TContextValues | undefined;
    const app = createApp({
      middleware,
      mountRoutes: (a) => {
        a.get('/something', (req, res) => {
          handlerCalled = true;
          handlerContextValues = deps.context.values;
          res.status(200).end();
        });
      },
    });
    const req = supertest(app).get('/something');
    if (params.onRequest) {
      params.onRequest(req);
    }
    const res = await req;
    return {
      res,
      handlerCalled,
      handlerContextValues,
    };
  }

  it('should process the request and delegate to next', async () => {
    const deps = createMockDeps();
    const middleware = createDiagMiddleware(deps);
    const { res, handlerCalled, handlerContextValues } = await sendRequest({ deps, middleware });
    expect(res.status).toEqual(200);
    expect(handlerCalled).toEqual(true);
    expect(handlerContextValues).toEqual({
      correlationId: expect.anything(),
    });
  });

  it('should generate a new correlationId', async () => {
    const wantCorrelationId = randomUUID();
    const deps = createMockDeps();
    jest.mocked(deps.uuidFn).mockReturnValueOnce(wantCorrelationId);
    const middleware = createDiagMiddleware(deps);
    const { handlerContextValues, res } = await sendRequest({ deps, middleware });
    expect(handlerContextValues?.correlationId).toEqual(wantCorrelationId);
    expect(deps.context.values.correlationId).not.toEqual(wantCorrelationId);
    expect(res.status).toEqual(200);
    expect(deps.uuidFn).toHaveBeenCalledTimes(1);
  });

  it.each(['X-Correlation-ID', 'X-Request-ID'])('should take correlationId from %s header', async (header) => {
    const wantCorrelationId = randomUUID();
    const deps = createMockDeps();
    const middleware = createDiagMiddleware(deps);
    const { handlerContextValues, res } = await sendRequest({
      deps,
      middleware,
      onRequest: (req) => req.set(header, wantCorrelationId),
    });
    expect(handlerContextValues?.correlationId).toEqual(wantCorrelationId);
    expect(deps.context.values.correlationId).not.toEqual(wantCorrelationId);
    expect(res.status).toEqual(200);
  });

  it('should set minLogLevel from X-Log-Level header', async () => {
    const deps = createMockDeps();
    const middleware = createDiagMiddleware(deps);
    const wantLevel = faker.helpers.objectValue(LogLevel);
    const { handlerContextValues, res } = await sendRequest({
      deps,
      middleware,
      onRequest: (req) => req.set('X-Log-Level', wantLevel),
    });
    expect(handlerContextValues?.minLogLevel).toEqual(wantLevel);
    expect(res.status).toEqual(200);
  });

  it('should ignore bad log level from X-Log-Level header', async () => {
    const deps = createMockDeps();
    const middleware = createDiagMiddleware(deps);
    const { handlerContextValues, res } = await sendRequest({
      deps,
      middleware,
      onRequest: (req) => req.set('X-Log-Level', faker.lorem.word()),
    });
    expect(handlerContextValues?.minLogLevel).toBeUndefined();
    expect(res.status).toEqual(200);
  });
});
