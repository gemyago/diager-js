import * as pino from 'pino';
import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';
import { createContext } from '../src/context.js';
import { createRootPinoLogger } from '../src/pino-adapter.js';

describe('pino-adapter', () => {
  const createMockDestination = () => {
    const written: string[] = [];
    return {
      get written() {
        return written;
      },
      write(data: string) {
        written.push(data);
      },
    };
  };

  describe('write methods', () => {
    it.each([
      ['error' as const, 50],
      ['warn' as const, 40],
      ['info' as const, 30],
      ['debug' as const, 20],
      ['trace' as const, 10],
    ] as const)('should write log messages with %s level', (levelName, levelNum) => {
      const mockDestination = createMockDestination();
      const diagCtxVals = { correlationId: randomUUID() };
      const rootLogger = createRootPinoLogger({
        context: createContext(diagCtxVals),
        pinoLogger: pino.pino({
          level: 'trace',
        }, mockDestination),
      });

      const wantMsg = faker.lorem.sentence();
      rootLogger[levelName](wantMsg);
      expect(mockDestination.written).toHaveLength(1);
      const gotMessage = JSON.parse(mockDestination.written[0]);
      expect(gotMessage).toMatchObject({
        level: levelNum,
        msg: wantMsg,
        context: diagCtxVals,
      });
    });
  });
});
