import * as pino from 'pino';
import { randomUUID } from 'crypto';
import { faker } from '@faker-js/faker';
import { ContextValues, createContext } from '../src/context.js';
import { createRootPinoLogger } from '../src/pino-adapter.js';
import { LogLevel } from '../src/logger.js';

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

  function createMockDeps() {
    const diagCtxVals: ContextValues = { correlationId: randomUUID() };
    const context = createContext(diagCtxVals);
    const mockDestination = createMockDestination();
    return {
      mockDestination,
      diagCtxVals,
      context,
      pinoLogger: pino.pino({ level: 'trace' }, mockDestination),
    };
  }

  describe('write methods', () => {
    const knownLevels = [
      [LogLevel.error, 50],
      [LogLevel.warn, 40],
      [LogLevel.info, 30],
      [LogLevel.debug, 20],
      [LogLevel.trace, 10],
    ] as const;

    it.each(knownLevels)(
      'should write log messages with %s level',
      (levelName, levelNum) => {
        const mockDeps = createMockDeps();
        const rootLogger = createRootPinoLogger(mockDeps);

        const wantMsg = faker.lorem.sentence();
        rootLogger[levelName](wantMsg);
        expect(mockDeps.mockDestination.written).toHaveLength(1);
        const gotMessage = mockDeps.mockDestination.written[0];
        expect(gotMessage).toMatchObject({
          level: levelNum,
          msg: wantMsg,
          context: mockDeps.diagCtxVals,
        });
      },
    );

    describe('generic write', () => {
      it('should write log messages with runtime defined level', () => {
        const mockDeps = createMockDeps();
        const rootLogger = createRootPinoLogger(mockDeps);

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
        mockDeps.pinoLogger.level = 'info';
        const rootLogger = createRootPinoLogger(mockDeps);

        const wantMsg = faker.lorem.sentence();
        rootLogger.write('debug', wantMsg);
        expect(mockDeps.mockDestination.written).toHaveLength(0);
      });
    });
  });

  describe('isLevelEnabled', () => {
    it.each([
      { actual: 'error', configured: 'warn', want: true },
      { actual: 'warn', configured: 'warn', want: true },
      { actual: 'debug', configured: 'info', want: false },
      { actual: 'trace', configured: 'info', want: false },
    ] as const)(
      'should be true if actual level ($actual) is above configured ($configured)',
      (tc) => {
        const mockDeps = createMockDeps();
        mockDeps.pinoLogger.level = tc.configured;
        const rootLogger = createRootPinoLogger(mockDeps);
        expect(rootLogger.isLevelEnabled(tc.actual)).toBe(tc.want);
      },
    );

    it.each([
      { actual: 'error', configured: 'warn', want: true },
      { actual: 'warn', configured: 'warn', want: true },
      { actual: 'debug', configured: 'info', want: false },
      { actual: 'trace', configured: 'info', want: false },
    ] as const)(
      'should be true if actual level ($actual) is above configured ($configured) defined in context',
      (tc) => {
        const mockDeps = createMockDeps();
        mockDeps.pinoLogger.level = 'trace';
        const rootLogger = createRootPinoLogger(mockDeps);
        mockDeps.context.child({ minLogLevel: tc.configured }, () => {
          expect(rootLogger.isLevelEnabled(tc.actual)).toBe(tc.want);
        });
      },
    );

    it.each([
      { actual: 'error', configured: 'warn', want: true },
      { actual: 'warn', configured: 'warn', want: true },
      { actual: 'debug', configured: 'info', want: false },
      { actual: 'trace', configured: 'info', want: false },
    ] as const)(
      'should be properly inherited from parent (actual: $actual, configured: $configured)',
      (tc) => {
        const mockDeps = createMockDeps();
        mockDeps.pinoLogger.level = tc.configured;
        const rootLogger = createRootPinoLogger(mockDeps);
        const childLogger = rootLogger.withGroup(faker.lorem.word());
        expect(childLogger.isLevelEnabled(tc.actual)).toBe(tc.want);
      },
    );

    it('should delegate to pino if level is unknown', () => {
      const mockDeps = createMockDeps();
      const rootLogger = createRootPinoLogger(mockDeps);
      const unknownLevel = faker.lorem.word() as LogLevel;
      mockDeps.pinoLogger.isLevelEnabled = jest.fn(() => true);
      expect(rootLogger.isLevelEnabled(unknownLevel)).toBe(true);
      expect(mockDeps.pinoLogger.isLevelEnabled).toHaveBeenCalledWith(
        unknownLevel,
      );
    });
  });

  describe('withGroup', () => {
    it('should create a child logger with a group name', () => {
      const mockDeps = createMockDeps();
      const rootLogger = createRootPinoLogger(mockDeps);

      const wantGroup = faker.lorem.word();
      const childLogger = rootLogger.withGroup(wantGroup);
      expect(childLogger).not.toBe(rootLogger);

      const wantMsg = faker.lorem.sentence();
      childLogger.error(wantMsg);
      expect(mockDeps.mockDestination.written).toHaveLength(1);
      const gotMessage = mockDeps.mockDestination.written[0];
      expect(gotMessage).toMatchObject({
        group: wantGroup,
      });
    });
  });

  describe('withData', () => {
    it('should include additional data with log output', () => {
      const mockDeps = createMockDeps();
      const rootLogger = createRootPinoLogger(mockDeps);

      const wantData = {
        key1: faker.lorem.word(),
        key2: faker.lorem.word(),
      };

      const wantMsg = faker.lorem.sentence();
      rootLogger.withData(wantData).error(wantMsg);
      expect(mockDeps.mockDestination.written).toHaveLength(1);
      const gotMessage = mockDeps.mockDestination.written[0];
      expect(gotMessage).toMatchObject({
        data: wantData,
      });
    });
  });

  describe('withError', () => {
    it('should include error object with log output', () => {
      const mockDeps = createMockDeps();
      const rootLogger = createRootPinoLogger(mockDeps);

      const wantError = new Error(faker.lorem.sentence());

      const wantMsg = faker.lorem.sentence();
      rootLogger.withError(wantError).error(wantMsg);
      expect(mockDeps.mockDestination.written).toHaveLength(1);
      const gotMessage = mockDeps.mockDestination.written[0];
      expect(gotMessage).toMatchObject({
        err: {
          message: wantError.message,
          stack: wantError.stack,
        },
      });
    });
  });
});
