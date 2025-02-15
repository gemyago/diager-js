import * as pino from 'pino';
import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';
import { createContext } from '../src/context.js';
import { createRootPinoLogger } from '../src/pino-adapter.js';

describe('pino-adapter', () => {
  const createMockDestination = () => {
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

  describe('write methods', () => {
    const knownLevels = [
      ['error' as const, 50],
      ['warn' as const, 40],
      ['info' as const, 30],
      ['debug' as const, 20],
      ['trace' as const, 10],
    ] as const;

    function createMockDeps() {
      const diagCtxVals = { correlationId: randomUUID() };
      const context = createContext(diagCtxVals);
      const mockDestination = createMockDestination();
      return {
        mockDestination,
        diagCtxVals,
        context,
      };
    }

    it.each(knownLevels)('should write log messages with %s level', (levelName, levelNum) => {
      const mockDeps = createMockDeps();
      const rootLogger = createRootPinoLogger({
        context: mockDeps.context,
        pinoLogger: pino.pino({ level: 'trace' }, mockDeps.mockDestination),
      });

      const wantMsg = faker.lorem.sentence();
      rootLogger[levelName](wantMsg);
      expect(mockDeps.mockDestination.written).toHaveLength(1);
      const gotMessage = mockDeps.mockDestination.written[0];
      expect(gotMessage).toMatchObject({
        level: levelNum,
        msg: wantMsg,
        context: mockDeps.diagCtxVals,
      });
    });

    describe('generic write', () => {
      it('should write log messages with runtime defined level', () => {
        const mockDeps = createMockDeps();
        const rootLogger = createRootPinoLogger({
          context: mockDeps.context,
          pinoLogger: pino.pino({ level: 'trace' }, mockDeps.mockDestination),
        });

        const wantLevel = faker.helpers.arrayElement(knownLevels);
        const wantMsg = faker.lorem.sentence();
        rootLogger.write(wantLevel[0], wantMsg);
        expect(mockDeps.mockDestination.written).toHaveLength(1);
        const gotMessage = mockDeps.mockDestination.written[0];
        expect(gotMessage).toMatchObject({
          level: wantLevel[1],
          msg: wantMsg,
          context: mockDeps.diagCtxVals,
        });
      });

      it('should not write log messages with level below minLogLevel', () => {
        const mockDeps = createMockDeps();
        const rootLogger = createRootPinoLogger({
          context: mockDeps.context,
          pinoLogger: pino.pino({ level: 'info' }, mockDeps.mockDestination),
        });

        const wantMsg = faker.lorem.sentence();
        rootLogger.write('debug', wantMsg);
        expect(mockDeps.mockDestination.written).toHaveLength(0);
      });
    });

    describe('isLevelEnabled', () => {

    });
  });
});
