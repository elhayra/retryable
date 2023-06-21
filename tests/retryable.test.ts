import { Retryable } from '../src';

async function foo(x: number): Promise<number> {
  return x;
}

class CustomErrorA extends Error {}
class CustomErrorB {}

let retryableFoo: Retryable<number>;

describe('retryable tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();

    retryableFoo = new Retryable(foo);
  });
  describe('retry config', () => {
    describe('not calling config functions', () => {
      it('should use defaults', () => {
        expect(retryableFoo.retry._times).toEqual(3);
        expect(retryableFoo.retry._intervalMillis).toEqual(1000);
        expect(retryableFoo.retry._backoffFactor).toEqual(1);
        expect(retryableFoo.retry._returnedValues).toEqual([]);
        expect(retryableFoo.retry._errors).toStrictEqual([Error]);
      });
    });

    describe('calling config functions once', () => {
      it('should update the config', () => {
        retryableFoo.retry
          .times(10)
          .atIntervalsOf(2000)
          .withBackoffFactor(3)
          .ifItReturns(1)
          .ifItThrows(CustomErrorA);

        expect(retryableFoo.retry._times).toEqual(10);
        expect(retryableFoo.retry._intervalMillis).toEqual(2000);
        expect(retryableFoo.retry._backoffFactor).toEqual(3);
        expect(retryableFoo.retry._returnedValues).toEqual([1]);
        expect(retryableFoo.retry._errors).toStrictEqual([Error, CustomErrorA]);
      });
    });

    describe('calling config functions twice', () => {
      it('should take the last value or append to array', () => {
        retryableFoo.retry
          .times(10)
          .times(5)
          .atIntervalsOf(2000)
          .atIntervalsOf(3000)
          .withBackoffFactor(3)
          .withBackoffFactor(5)
          .ifItReturns(1)
          .ifItReturns(2)
          .ifItReturns(null)
          .ifItReturns(undefined)
          .ifItThrows(CustomErrorA)
          .ifItThrows(CustomErrorB);

        expect(retryableFoo.retry._times).toEqual(5);
        expect(retryableFoo.retry._intervalMillis).toEqual(3000);
        expect(retryableFoo.retry._backoffFactor).toEqual(5);
        expect(retryableFoo.retry._returnedValues).toEqual([1, 2, null, undefined]);
        expect(retryableFoo.retry._errors).toStrictEqual([Error, CustomErrorA, CustomErrorB]);
      });
    });
  });
});
