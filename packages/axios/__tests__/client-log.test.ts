import axios, { Method } from 'axios';
import {
  createServer, IncomingHttpHeaders, IncomingMessage, Server, ServerResponse,
} from 'http';
import { AddressInfo } from 'net';
import { faker } from '@faker-js/faker';
import {
  ContextValues, createContext, createRootPinoLogger, LogLevel,
} from '@diager-js/core';
import { randomUUID } from 'crypto';
import pino from 'pino';
import {
  formatUserAgent, createAxiosClientLogInterceptors, ModuleInfo, HttpTransportError,
} from '../src/client-log.js';

describe('client-log', () => {
  function randomModuleInfo(
    opts?: Partial<ModuleInfo>,
  ): ModuleInfo {
    return {
      name: faker.commerce.productName(),
      version: faker.system.semver(),
      ...opts,
    };
  }

  describe('formatUserAgent', () => {
    afterEach(() => {
      delete process.env.GCP_PROJECT;
    });

    it('should build user agent', () => {
      const moduleInfo = randomModuleInfo();
      expect(formatUserAgent(moduleInfo))
        .toEqual(`${moduleInfo.name}/${moduleInfo.version} node/${process.version}`);
    });

    it('should build user agent with meta', () => {
      const moduleInfo = randomModuleInfo({
        meta: {
          key1: faker.lorem.word(),
          key2: faker.lorem.word(),
        },
      });
      expect(formatUserAgent(moduleInfo))
        .toEqual(`${moduleInfo.name}/${moduleInfo.version} node/${process.version} (key1=${moduleInfo.meta?.key1}; key2=${moduleInfo.meta?.key2})`);
    });
  });

  describe('axios interceptors', () => {
    let server : Server | null;
    afterEach(async () => {
      if (server !== null) {
        const srv = server;
        server = null;
        await new Promise<void>((res, rej) => {
          srv.close((err) => {
            if (err) {
              return rej(err);
            }
            return res();
          });
        });
      }
    });

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
      return {
        logger,
        destination,
        logEntries: destination.written,
      };
    }

    it('should log start and end entries for ok requests', async () => {
      const wantMethod: Method = faker.helpers.arrayElement(['get', 'post', 'put', 'delete']);
      const mockLogger = createMockLogger();
      const wantCode = faker.number.int({ min: 200, max: 299 });
      const wantReqHeaders = {
        Accept: 'application/json',
        'Content-Type': 'text/plain',
        [faker.lorem.word()]: faker.lorem.word(),
        [faker.lorem.word()]: faker.lorem.word(),
      };
      const wantResHeaders = {
        [faker.lorem.word()]: faker.lorem.word(),
        [faker.lorem.word()]: faker.lorem.word(),
      };
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          for (const [key, value] of Object.entries(wantResHeaders)) {
            res.setHeader(key, value);
          }
          res.writeHead(wantCode).end();
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({ baseURL });
      createAxiosClientLogInterceptors({
        userAgent: faker.commerce.productName(),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      await client.request({
        method: wantMethod,
        url: urlPath,
        headers: wantReqHeaders,
      });
      expect(mockLogger.logEntries).toHaveLength(2);

      const startSendingEntry = mockLogger.logEntries[0];
      expect(startSendingEntry).toEqual(expect.objectContaining({
        level: 30,
        msg: `SEND_REQUEST_STARTED: ${wantMethod.toUpperCase()} ${urlPath}`,
        data: expect.objectContaining({
          method: wantMethod.toUpperCase(),
          baseURL,
          path: urlPath,
          headers: expect.objectContaining(wantReqHeaders),
        }),
      }));

      const completeSendingEntry = mockLogger.logEntries[1];
      expect(completeSendingEntry).toEqual(expect.objectContaining({
        level: 30,
        msg: `SEND_REQUEST_COMPLETED: ${wantCode} - ${urlPath}`,
        data: expect.objectContaining({
          statusCode: wantCode,
          headers: expect.objectContaining({
            ...wantResHeaders,
            'transfer-encoding': 'chunked',
          }),
        }),
      }));
    });

    it('should log with custom level', async () => {
      const wantMethod: Method = faker.helpers.arrayElement(['get', 'post', 'put', 'delete']);
      const mockLogger = createMockLogger();
      const wantCode = faker.number.int({ min: 200, max: 299 });
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          res.writeHead(wantCode).end();
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({ baseURL });
      createAxiosClientLogInterceptors({
        userAgent: formatUserAgent(randomModuleInfo()),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
        logLevel: 'debug',
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      await client.request({
        method: wantMethod,
        url: urlPath,
      });
      expect(mockLogger.logEntries).toHaveLength(2);

      const startSendingEntry = mockLogger.logEntries[0];
      expect(startSendingEntry).toEqual(expect.objectContaining({
        level: 20,
      }));

      const completeSendingEntry = mockLogger.logEntries[1];
      expect(completeSendingEntry).toEqual(expect.objectContaining({
        level: 20,
      }));
    });

    it('should not include response body for success', async () => {
      const mockLogger = createMockLogger();
      const wantCode = faker.number.int({ min: 200, max: 299 });
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          res.writeHead(wantCode).end(faker.lorem.sentence(3));
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({ baseURL });
      createAxiosClientLogInterceptors({
        userAgent: formatUserAgent(randomModuleInfo()),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      await client.request({
        method: 'get',
        url: urlPath,
      });
      expect(mockLogger.logEntries).toHaveLength(2);
      const completeSendingEntry = mockLogger.logEntries[1];
      expect(completeSendingEntry).toEqual(expect.objectContaining({
        data: expect.not.objectContaining({ body: expect.any(String) }),
      }));
    });

    it('should inject User-Agent', async () => {
      const wantMethod: Method = faker.helpers.arrayElement(['get', 'post', 'put', 'delete']);
      const mockLogger = createMockLogger();
      const wantUserAgent = faker.commerce.productName();
      let gotUserAgent : string | undefined;
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          gotUserAgent = req.headers['user-agent'];
          res.writeHead(200).end();
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({
        baseURL,
      });
      createAxiosClientLogInterceptors({
        userAgent: wantUserAgent,
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      await client.request({
        method: wantMethod,
        url: urlPath,
      });
      expect(mockLogger.logEntries).toHaveLength(2);

      const startSendingEntry = mockLogger.logEntries[0];
      expect(gotUserAgent).toEqual(wantUserAgent);
      expect(startSendingEntry).toEqual(expect.objectContaining({
        data: expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': wantUserAgent,
          }),
        }),
      }));
    });

    it('should use caller provided User-Agent', async () => {
      const wantMethod: Method = faker.helpers.arrayElement(['get', 'post', 'put', 'delete']);
      const mockLogger = createMockLogger();
      const wantUserAgent = faker.internet.userAgent();
      let gotUserAgent : string | undefined;
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          gotUserAgent = req.headers['user-agent'];
          res.writeHead(200).end();
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({
        baseURL,
      });
      createAxiosClientLogInterceptors({
        userAgent: faker.commerce.productName(),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      await client.request({
        method: wantMethod,
        url: urlPath,
        headers: {
          'User-Agent': wantUserAgent,
        },
      });
      expect(mockLogger.logEntries).toHaveLength(2);

      const startSendingEntry = mockLogger.logEntries[0];
      expect(gotUserAgent).toEqual(wantUserAgent);
      expect(startSendingEntry).toEqual(expect.objectContaining({
        data: expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': wantUserAgent,
          }),
        }),
      }));
    });

    it('should handle configured headers', async () => {
      const wantMethod: Method = faker.helpers.arrayElement(['get', 'post', 'put', 'delete']);
      const mockLogger = createMockLogger();
      const wantCommonReqHeaders = {
        Accept: faker.lorem.word(),
        [`common-${faker.lorem.word()}`]: faker.lorem.word(),
        [`common-${faker.lorem.word()}`]: faker.lorem.word(),
      };
      const wantMethodReqHeaders = {
        'Content-Type': faker.lorem.word(),
        [`method-${faker.lorem.word()}`]: faker.lorem.word(),
        [`method-${faker.lorem.word()}`]: faker.lorem.word(),
      };
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          res.writeHead(200).end();
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({
        baseURL,
        headers: {
          common: wantCommonReqHeaders as never,
          [wantMethod]: wantMethodReqHeaders as never,
        },
      });
      createAxiosClientLogInterceptors({
        userAgent: formatUserAgent(randomModuleInfo()),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      await client.request({
        method: wantMethod,
        url: urlPath,
      });
      expect(mockLogger.logEntries).toHaveLength(2);

      const startSendingEntry = mockLogger.logEntries[0];
      expect(startSendingEntry).toEqual(expect.objectContaining({
        data: expect.objectContaining({
          headers: expect.objectContaining({
            ...wantCommonReqHeaders,
            ...wantMethodReqHeaders,
          }),
        }),
      }));
    });

    it('should end for error', async () => {
      const wantMethod: Method = faker.helpers.arrayElement(['get', 'post', 'put', 'delete']);
      const mockLogger = createMockLogger();
      const wantCode = faker.number.int({ min: 399, max: 599 });
      const wantResHeaders = {
        [faker.lorem.word()]: faker.lorem.word(),
        [faker.lorem.word()]: faker.lorem.word(),
      };
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          for (const [key, value] of Object.entries(wantResHeaders)) {
            res.setHeader(key, value);
          }
          res.writeHead(wantCode).end();
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({ baseURL });
      createAxiosClientLogInterceptors({
        userAgent: formatUserAgent(randomModuleInfo()),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      const err = await client.request({
        method: wantMethod,
        url: urlPath,
      })
        .then(() => null)
        .catch((e) => e);
      expect(err).not.toBeNull();
      expect(mockLogger.logEntries).toHaveLength(2);
      const completeSendingEntry = mockLogger.logEntries[1];
      expect(completeSendingEntry).toEqual(expect.objectContaining({
        level: 30,
        msg: `SEND_REQUEST_COMPLETED: ${wantCode} - ${urlPath}`,
        data: expect.objectContaining({
          statusCode: wantCode,
          headers: expect.objectContaining({
            ...wantResHeaders,
            'transfer-encoding': 'chunked',
          }),
        }),
      }));
    });

    it('should end for error with response data', async () => {
      const mockLogger = createMockLogger();
      const wantCode = faker.number.int({ min: 399, max: 599 });
      const wantData = faker.lorem.sentence(3);
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          res.writeHead(wantCode).end(wantData);
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({ baseURL });
      createAxiosClientLogInterceptors({
        userAgent: formatUserAgent(randomModuleInfo()),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      const err = await client.request({
        method: 'get',
        url: urlPath,
      })
        .then(() => null)
        .catch((e) => e);
      expect(err).not.toBeNull();
      expect(mockLogger.logEntries).toHaveLength(2);
      const completeSendingEntry = mockLogger.logEntries[1];
      expect(completeSendingEntry).toEqual(expect.objectContaining({
        data: expect.objectContaining({
          body: wantData,
        }),
      }));
    });

    it('should end for error with response data stream', async () => {
      const mockLogger = createMockLogger();
      const wantCode = faker.number.int({ min: 399, max: 599 });
      const wantData = faker.lorem.sentence(3);
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          res.writeHead(wantCode).end(wantData);
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({
        baseURL,
        responseType: 'stream',
      });
      createAxiosClientLogInterceptors({
        userAgent: formatUserAgent(randomModuleInfo()),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      const res = await await client.request({
        method: 'get',
        url: urlPath,
      })
        .then(() => null)
        .catch((e) => e);
      expect(res).not.toBeNull();
      expect(mockLogger.logEntries).toHaveLength(2);
      const completeSendingEntry = mockLogger.logEntries[1];
      expect(completeSendingEntry).toEqual(expect.objectContaining({
        data: expect.objectContaining({
          body: wantData,
        }),
      }));
    });

    it('should wrap transport error', async () => {
      const mockLogger = createMockLogger();
      const wantBody = faker.lorem.sentence(3);
      const wantCode = faker.number.int({ min: 399, max: 599 });
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          res.writeHead(wantCode).end(wantBody);
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({ baseURL });
      createAxiosClientLogInterceptors({
        userAgent: formatUserAgent(randomModuleInfo()),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      const err = await client.request({
        method: 'get',
        url: urlPath,
      }).then(() => null)
        .catch((e) => e);
      expect(err).not.toBeNull();
      expect(err).toBeInstanceOf(HttpTransportError);
      const transportErr = err as HttpTransportError;
      expect(transportErr).toEqual(expect.objectContaining({
        name: 'HTTP_TRANSPORT_ERROR',
        response: expect.objectContaining({
          status: wantCode,
          data: wantBody,
        }),
        cause: expect.anything(),
      }));
    });

    it('should keep request/response unaffected', async () => {
      const wantCode = faker.number.int({ min: 200, max: 299 });
      const wantReqData = faker.lorem.sentence(3);
      const wantResData = faker.lorem.sentence(3);
      const mockLogger = createMockLogger();
      let gotReq : {
        url?: string,
        body: string,
      } | undefined;
      server = createServer(
        async (req: IncomingMessage, res: ServerResponse) => {
          const buffers: never[] = [];
          for await (const chunk of req) {
            buffers.push(chunk as never);
          }
          const body = Buffer.concat(buffers).toString();
          gotReq = {
            url: req.url,
            body,
          };
          res.writeHead(wantCode);
          res.write(wantResData);
          res.end();
        },
      ).listen();
      const address = server.address() as AddressInfo;
      const baseURL = `http://localhost:${address.port}`;
      const client = axios.create({ baseURL });
      createAxiosClientLogInterceptors({
        userAgent: formatUserAgent(randomModuleInfo()),
        logger: mockLogger.logger,
        context: createContext({ correlationId: randomUUID() }),
      }).attachTo(client);
      const urlPath = `/something/${faker.lorem.word()}/something2`;
      const res = await client.post(urlPath, wantReqData);
      expect(gotReq).toEqual({
        url: urlPath,
        body: wantReqData,
      });
      expect(res.status).toEqual(wantCode);
      expect(res.data).toEqual(wantResData);
    });

    describe('context', () => {
      it('should inject default context headers', async () => {
        const mockLogger = createMockLogger();
        const context = createContext<ContextValues>({ correlationId: randomUUID().toString() });
        let gotHeaders : IncomingHttpHeaders | undefined;
        server = createServer(
          async (req: IncomingMessage, res: ServerResponse) => {
            gotHeaders = req.headers;
            res.end();
          },
        ).listen();
        const address = server.address() as AddressInfo;
        const baseURL = `http://localhost:${address.port}`;
        const client = axios.create({ baseURL });
        createAxiosClientLogInterceptors({
          userAgent: formatUserAgent(randomModuleInfo()),
          logger: mockLogger.logger,
          context,
        }).attachTo(client);
        const urlPath = `/something/${faker.lorem.word()}/something2`;
        const correlationId = faker.string.uuid();
        const logLevel = faker.helpers.objectValue(LogLevel);
        const res = await context.child({
          correlationId,
          minLogLevel: logLevel,
        }, () => client.get(urlPath));
        expect(res.status).toEqual(200);
        expect(gotHeaders?.['x-correlation-id']).toEqual(correlationId);
        expect(gotHeaders?.['x-log-level']).toEqual(logLevel);
      });
    });
  });
});
