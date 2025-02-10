import { faker } from '@faker-js/faker';
import { ContextValues, createContext } from '../src/context';

describe('context', () => {
  type TestContextValues = ContextValues & {
    field1: string
    field2: string
  }

  function randomContextValues(): TestContextValues {
    return {
      correlationId: faker.string.uuid(),
      field1: faker.lorem.word(),
      field2: faker.lorem.word(),
    };
  }

  describe('values', () => {
    it('should return root values', () => {
      const rootValues = randomContextValues();
      const ctx = createContext(rootValues);
      expect(ctx.values).toEqual(rootValues);
    });
  });

  describe('run', () => {
    it('should return specified values', () => {
      const ctx = createContext(randomContextValues());
      const wantValues = randomContextValues();

      const gotValues = ctx.run(wantValues, () => ctx.values);
      expect(gotValues).toEqual(wantValues);
    });
  });

  describe('child', () => {
    it('should allow partially overriding values', () => {
      const rootValues = randomContextValues();
      const overrides = {
        correlationId: faker.string.uuid(),
        field2: `new-val-${faker.lorem.word()}`,
      };
      const ctx = createContext(rootValues);
      const gotVals = ctx.child(overrides, () => ctx.values);
      expect(gotVals).toEqual<typeof gotVals>({
        ...rootValues,
        ...overrides,
      });
    });
  });
});
