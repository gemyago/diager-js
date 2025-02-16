import express, {
  ErrorRequestHandler, Request, Response, RequestHandler,
} from 'express';
import supertest from 'supertest';
import { createContext, createRootPinoLogger } from '@diager-js/core';
import pino from 'pino';
import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';
import { createAccessLogMiddleware } from '../../src/middleware/access-log';

describe('access-log-middleware', () => {
  // has to have 4 arguments
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    res.status(500).send({
      error: err.message,
      stack: err.stack,
    });
  };

  const createMockLogDestination = () => {
    const written: object[] = [];
    return {
      get written() {
        return written;
      },
      write(data: string) {
        written.push(JSON.parse(data));
      },
    };
  };

  function createMockLogger() {
    const destination = createMockLogDestination();
    const logger = createRootPinoLogger({
      context: createContext({ correlationId: randomUUID() }),
      pinoLogger: pino({ level: 'trace' }, destination),
    });
    return { logger, destination };
  }

  function createMockDeps() {
    const mockLogger = createMockLogger();
    return {
      logger: mockLogger.logger,
      logEntries: mockLogger.destination.written,
    };
  }

  async function sendRequest(params: {
    middleware: RequestHandler,
    onRequest?: (req: supertest.Test) => void,
    onHandler?: (req: Request, res: Response) => void,
    requestPath?: string,
  }) {
    const { middleware } = params;
    let handlerCalled = false;

    const app = express();
    app.use(middleware);
    app.get(params.requestPath ?? '/something', (req, res) => {
      handlerCalled = true;
      if (params.onHandler) {
        params.onHandler(req, res);
      } else {
        res.status(200).end();
      }
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
    };
  }

  it('should write begin/end logs', async () => {
    const { logger, logEntries } = createMockDeps();
    const wantPath = `/path1-${faker.lorem.word()}/path2-${faker.lorem.word()}`;
    const { res } = await sendRequest({
      middleware: createAccessLogMiddleware({ logger }),
      requestPath: wantPath,
    });
    expect(res.status).toEqual(200);
    expect(logEntries.length).toEqual(2);
    const [beginReqLog, endReqLog] = logEntries;
    expect(beginReqLog).toEqual(expect.objectContaining({
      msg: `START_PROCESSING_REQ: GET ${wantPath}`,
    }));
    expect(endReqLog).toEqual(expect.objectContaining({
      msg: `END_PROCESSING_REQ: 200 - ${wantPath}`,
    }));
  });

  it('should handle end req status', async () => {
    const { logger, logEntries } = createMockDeps();
    const wantStatus = faker.number.int({ min: 400, max: 500 });
    const { res } = await sendRequest({
      middleware: createAccessLogMiddleware({ logger }),
      requestPath: '/something',
      onHandler(httpReq, httpRes) {
        httpRes.status(wantStatus).end();
      },
    });
    expect(res.status).toEqual(wantStatus);
    expect(logEntries.length).toEqual(2);
    const [, endReqLog] = logEntries;
    expect(endReqLog).toEqual(expect.objectContaining({
      msg: `END_PROCESSING_REQ: ${wantStatus} - /something`,
    }));
  });

  it('should include request details', async () => {
    const { logger, logEntries } = createMockDeps();
    const headers = {
      [`x-header1-${faker.lorem.word()}`]: `value1-${faker.lorem.word()}`,
      [`x-header2-${faker.lorem.word()}`]: `value2-${faker.lorem.word()}`,
      [`x-header3-${faker.lorem.word()}`]: `value3-${faker.lorem.word()}`,
    };
    const query = {
      [`query1-${faker.lorem.word()}`]: `value-${faker.lorem.word()}`,
      [`query2-${faker.lorem.word()}`]: `value-${faker.lorem.word()}`,
      [`query3-${faker.lorem.word()}`]: `value-${faker.lorem.word()}`,
    };
    const { res } = await sendRequest({
      middleware: createAccessLogMiddleware({ logger }),
      onRequest: (req) => req.query(query).set(headers),
    });
    expect(res.status).toEqual(200);

    const searchParams = new URLSearchParams(query);

    expect(logEntries.length).toEqual(2);
    const [beginReqLog] = logEntries;
    expect(beginReqLog).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        method: 'GET',
        url: `/something?${searchParams.toString()}`,
        headers: expect.objectContaining(headers),
        query: expect.objectContaining(query),
      }),
    }));
  });

  it('should include response details', async () => {
    const { logger, logEntries } = createMockDeps();
    const headers = {
      [`x-header1-${faker.lorem.word()}`]: `value1-${faker.lorem.word()}`,
      [`x-header2-${faker.lorem.word()}`]: `value2-${faker.lorem.word()}`,
      [`x-header3-${faker.lorem.word()}`]: `value3-${faker.lorem.word()}`,
    };
    const statusCode = 200;
    const { res } = await sendRequest({
      middleware: createAccessLogMiddleware({ logger }),
      requestPath: '/something',
      onHandler(httpReq, httpRes) {
        httpRes.set(headers).end();
      },
    });
    expect(res.status).toEqual(statusCode);

    expect(logEntries.length).toEqual(2);
    const [, endReqLog] = logEntries;
    expect(endReqLog).toEqual(expect.objectContaining({
      data: expect.objectContaining({
        statusCode,
        headers: expect.objectContaining(headers),
        durationMs: expect.any(Number),
      }),
    }));
  });

  it('should ignore paths', async () => {
    const { logger, logEntries } = createMockDeps();
    const ignorePaths = [
      `/ignore1/path1-${faker.lorem.word()}/path2-${faker.lorem.word()}`,
      `/ignore2/path1-${faker.lorem.word()}/path2-${faker.lorem.word()}`,
    ];
    const { res } = await sendRequest({
      middleware: createAccessLogMiddleware({ logger, ignorePaths }),
      requestPath: faker.helpers.arrayElement(ignorePaths),
    });
    expect(res.status).toEqual(200);
    expect(logEntries.length).toEqual(0);
  });
});
