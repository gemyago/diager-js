import express, { ErrorRequestHandler, RequestHandler } from 'express';
import { ContextValues, createContext, LogLevel } from '@diager-js/core';
import { randomUUID } from 'crypto';
import supertest from 'supertest';
import { faker } from '@faker-js/faker';
import { createDiagMiddleware } from '../../src/middleware/diag.js';

describe('diag-middleware', () => {
  // has to have 4 arguments
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    res.status(500).send({
      error: err.message,
      stack: err.stack,
    });
  };

  type Deps<TContextValues extends ContextValues> = Parameters<
    typeof createDiagMiddleware<TContextValues>
  >[0];
  function createMockDeps<TContextValues extends ContextValues>() {
    return {
      context: createContext({
        correlationId: randomUUID(),
      }) as Deps<TContextValues>['context'],
      uuidFn: jest.fn(randomUUID) as NonNullable<
        Deps<TContextValues>['uuidFn']
      >,
    };
  }

  async function sendRequest<TContextValues extends ContextValues>(params: {
    deps: Deps<TContextValues>;
    middleware: RequestHandler;
    onRequest?: (req: supertest.Test) => void;
    middlewarePath?: string;
    routePath?: string;
    requestPath?: string;
  }) {
    const { deps, middleware } = params;
    let handlerCalled = false;
    let handlerContextValues: TContextValues | undefined;

    const app = express();
    if (params.middlewarePath) {
      app.use(params.middlewarePath, middleware);
    } else {
      app.use(middleware);
    }
    app.get(params.routePath ?? '/something', (req, res) => {
      handlerCalled = true;
      handlerContextValues = deps.context.values;
      res.status(200).end();
    });
    app.use(errorHandler);

    const req = supertest(app).get(params.requestPath ?? '/something');
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
    const middleware = createDiagMiddleware({ context: deps.context });
    const { res, handlerCalled, handlerContextValues } = await sendRequest({
      deps,
      middleware,
    });
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
    const { handlerContextValues, res } = await sendRequest({
      deps,
      middleware,
    });
    expect(handlerContextValues?.correlationId).toEqual(wantCorrelationId);
    expect(deps.context.values.correlationId).not.toEqual(wantCorrelationId);
    expect(res.status).toEqual(200);
    expect(deps.uuidFn).toHaveBeenCalledTimes(1);
  });

  it.each(['X-Correlation-ID', 'X-Request-ID'])(
    'should take correlationId from %s header',
    async (header) => {
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
    },
  );

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

  it('should set correlationId and minLogLevel from configured headers', async () => {
    const deps = createMockDeps();
    const correlationIdHeader = `X-Custom-Correlation-ID-${faker.lorem.word()}`;
    const correlationIdValue = randomUUID();
    const logLevelHeader = `X-Custom-Log-Level-${faker.lorem.word()}`;
    const logLevelValue = faker.helpers.objectValue(LogLevel);
    const middleware = createDiagMiddleware({
      ...deps,
      contextHeaders: {
        [correlationIdHeader]: 'correlationId',
        [logLevelHeader]: { field: 'minLogLevel', parse: (v) => v as LogLevel },
      },
    });
    const { handlerContextValues, res } = await sendRequest({
      deps,
      middleware,
      onRequest: (req) => {
        req.set('X-Log-Level', faker.helpers.objectValue(LogLevel));
        req.set('X-Correlation-ID', randomUUID());

        req.set(correlationIdHeader, correlationIdValue);
        req.set(logLevelHeader, logLevelValue);
      },
    });
    expect(handlerContextValues).toEqual({
      correlationId: correlationIdValue,
      minLogLevel: logLevelValue,
    });
    expect(res.status).toEqual(200);
  });

  it('should set custom context values from configured headers', async () => {
    const field1Name = Symbol(`field1-${faker.lorem.word()}`);
    const field2Name = Symbol(`field2-${faker.lorem.word()}`);
    const field3Name = Symbol(`field3-${faker.lorem.word()}`);

    const field1Header = `X-${field1Name.description}-${faker.lorem.word()}`;
    const field2Header = `X-${field2Name.description}-${faker.lorem.word()}`;
    const field3Header = `X-${field3Name.description}-${faker.lorem.word()}`;

    const field1Value = faker.lorem.word();
    const field2Value = faker.lorem.word();
    const field3Value = faker.lorem.word();

    type CustomContextValues = ContextValues & {
      [field1Name]: string;
      [field2Name]: string;
      [field3Name]: string;
    };

    const deps = createMockDeps<CustomContextValues>();
    const middleware = createDiagMiddleware({
      ...deps,
      contextHeaders: {
        [field1Header]: field1Name,
        [field2Header]: field2Name,
        [field3Header]: field3Name,
      },
    });

    const { handlerContextValues, res } = await sendRequest({
      deps,
      middleware,
      onRequest: (req) => {
        req.set(field1Header, field1Value);
        req.set(field2Header, field2Value);
        req.set(field3Header, field3Value);
      },
    });

    expect(handlerContextValues).toEqual({
      correlationId: expect.anything(),
      [field1Name]: field1Value,
      [field2Name]: field2Value,
      [field3Name]: field3Value,
    });

    expect(res.status).toEqual(200);
  });

  it('should set custom non string context values from configured headers', async () => {
    const field1Name = Symbol(`field1-${faker.lorem.word()}`);
    const field2Name = Symbol(`field2-${faker.lorem.word()}`);
    const field3Name = Symbol(`field3-${faker.lorem.word()}`);

    const field1Header = `X-${field1Name.description}-${faker.lorem.word()}`;
    const field2Header = `X-${field2Name.description}-${faker.lorem.word()}`;
    const field3Header = `X-${field3Name.description}-${faker.lorem.word()}`;

    const field1Value = faker.number.int();
    const field2Value = faker.number.int();
    const field3Value = faker.number.int();

    type CustomContextValues = ContextValues & {
      [field1Name]: number;
      [field2Name]: number;
      [field3Name]: number;
    };

    const deps = createMockDeps<CustomContextValues>();
    const middleware = createDiagMiddleware({
      ...deps,
      contextHeaders: {
        [field1Header]: { field: field1Name, parse: (v) => parseInt(v, 10) },
        [field2Header]: { field: field2Name, parse: (v) => parseInt(v, 10) },
        [field3Header]: { field: field3Name, parse: (v) => parseInt(v, 10) },
      },
    });

    const { handlerContextValues, res } = await sendRequest({
      deps,
      middleware,
      onRequest: (req) => {
        req.set(field1Header, field1Value.toString());
        req.set(field2Header, field2Value.toString());
        req.set(field3Header, field3Value.toString());
      },
    });

    expect(handlerContextValues).toEqual({
      correlationId: expect.anything(),
      [field1Name]: field1Value,
      [field2Name]: field2Value,
      [field3Name]: field3Value,
    });

    expect(res.status).toEqual(200);
  });

  it('should set custom context values from path', async () => {
    const field1Name = Symbol(`field1-${faker.lorem.word()}`);
    const field2Name = Symbol(`field2-${faker.lorem.word()}`);

    const pathParam1 = `param1${faker.lorem.word()}`;
    const pathParam2 = `param1${faker.lorem.word()}`;

    const field1Value = faker.lorem.word();
    const field2Value = faker.number.int();

    type CustomContextValues = ContextValues & {
      [field1Name]: string;
      [field2Name]: number;
    };

    const deps = createMockDeps<CustomContextValues>();
    const middleware = createDiagMiddleware({
      ...deps,
      contextParams: {
        [pathParam1]: field1Name,
        [pathParam2]: { field: field2Name, parse: (v) => parseInt(v, 10) },
      },
    });

    const { handlerContextValues, res } = await sendRequest({
      deps,
      middleware,
      middlewarePath: `/params/param1/:${pathParam1}/param2/:${pathParam2}`,
      routePath: `/params/param1/:${pathParam1}/param2/:${pathParam2}/something`,
      requestPath: `/params/param1/${field1Value}/param2/${field2Value}/something`,
    });
    expect(res.status).toEqual(200);

    expect(handlerContextValues).toEqual({
      correlationId: expect.anything(),
      [field1Name]: field1Value,
      [field2Name]: field2Value,
    });
  });
});
