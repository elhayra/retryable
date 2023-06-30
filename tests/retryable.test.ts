import { Retryable } from '../src';

class FakeErrorA extends Error {}
class FakeErrorB {}

describe('retryable tests', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('retry config', () => {
    function fakeCallbackFunc(x: number, y: number): number {
      return x + y;
    }
    const fakeCallbackFuncMock = jest.fn(fakeCallbackFunc);
    let fakeRetryable: Retryable<number, [number, number]>;

    beforeEach(() => {
      fakeRetryable = new Retryable(fakeCallbackFuncMock);
    });

    describe('not calling config functions', () => {
      it('should use defaults', () => {
        expect(fakeRetryable.retry._times).toEqual(3);
        expect(fakeRetryable.retry._intervalMillis).toEqual(1000);
        expect(fakeRetryable.retry._backoffFactor).toEqual(1);
        expect(fakeRetryable.retry._returnedValues).toEqual(new Set());
        expect(fakeRetryable.retry._errors).toStrictEqual(new Set([Error]));
      });
    });

    describe('calling config functions once', () => {
      it('should update the config', () => {
        fakeRetryable.retry
          .times(10)
          .atIntervalsOf(2000)
          .withBackoffFactor(3)
          .ifItReturns(1)
          .ifItThrows(FakeErrorA);

        expect(fakeRetryable.retry._times).toEqual(10);
        expect(fakeRetryable.retry._intervalMillis).toEqual(2000);
        expect(fakeRetryable.retry._backoffFactor).toEqual(3);
        expect(fakeRetryable.retry._returnedValues).toEqual(new Set([1]));
        expect(fakeRetryable.retry._errors).toStrictEqual(new Set([Error, FakeErrorA]));
      });
    });

    describe('calling config functions twice', () => {
      it('should take the last value in case of duplicate settings', () => {
        fakeRetryable.retry
          .times(10)
          .times(5)
          .atIntervalsOf(2000)
          .atIntervalsOf(3000)
          .withBackoffFactor(3)
          .withBackoffFactor(5);

        expect(fakeRetryable.retry._times).toEqual(5);
        expect(fakeRetryable.retry._intervalMillis).toEqual(3000);
        expect(fakeRetryable.retry._backoffFactor).toEqual(5);
      });

      it('should add unique triggers to the set', () => {
        fakeRetryable.retry
          .ifItReturns(1)
          .ifItReturns(2)
          .ifItReturns(null)
          .ifItReturns(undefined)
          .ifItThrows(FakeErrorA)
          .ifItThrows(FakeErrorB);

        expect(fakeRetryable.retry._returnedValues).toEqual(new Set([1, 2, null, undefined]));
        expect(fakeRetryable.retry._errors).toStrictEqual(new Set([Error, FakeErrorA, FakeErrorB]));
      });

      it('should not store duplicate triggers', () => {
        fakeRetryable.retry
          .ifItReturns(1)
          .ifItReturns(1)
          .ifItReturns(2)
          .ifItReturns(2)
          .ifItThrows(FakeErrorA)
          .ifItThrows(FakeErrorA)
          .ifItThrows(FakeErrorB)
          .ifItThrows(FakeErrorB);

        expect(fakeRetryable.retry._returnedValues).toEqual(new Set([1, 2]));
        expect(fakeRetryable.retry._errors).toStrictEqual(new Set([FakeErrorA, FakeErrorB, Error]));
      });
    });
  });

  describe('retry execution', () => {
    describe('callback function succeeded on first try', () => {
      describe('callback is an async function with arguments', () => {
        it('should return the callback returned value', async () => {
          const fakeCallbackFunc = jest.fn((x: number, y: number): string => `test ${x}, ${y}`);
          const fakeRetryable: Retryable<string, [number, number]> = new Retryable(
            fakeCallbackFunc
          );

          fakeRetryable.retry.times(3).atIntervalsOf(1000);

          await expect(fakeRetryable.run(1, 2)).resolves.toEqual('test 1, 2');
          expect(fakeCallbackFunc).toHaveBeenCalledTimes(1);
        });
      });

      describe('callback is a sync function with arguments', () => {
        it('should return the callback returned value', () => {});
      });

      describe('callback is an async function without arguments', () => {
        it('should return the callback returned value', async () => {});
      });

      describe('callback is a sync function without arguments', () => {
        it('should return the callback returned value', () => {});
      });

      describe('callback is a sync function with not return value (void)', () => {
        it('should return the callback returned value', () => {});
      });
    });

    describe('callback function triggers are set and met', () => {
      describe('callback function succeeded on the 5th try out of 5', () => {
        it('should return the callback returned value, and store trigger history', () => {
          // set num of retries to 5
          // set triggers: some value, exception, exception, some value
          // make sure that the function was called 5 times
        });
      });

      describe('callback function failed on all tries', () => {
        it('should throw', () => {
          //set num of retries to 3
          // make sure that the function was called no more than number of retry allowed
        });
      });
    });

    describe('callback function triggers are set but never met', () => {
      it('should not retry, even if the function throws', () => {});
    });

    // describe('set to retry with backoff', () => {
    //   it('should retry with backoff', () => {});
    // });
  });
});
