import { Retryable } from '../src';
import { sleep } from '../src/sleep';

jest.mock('../src/sleep');
const mockedSleep = sleep as jest.Mock;

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
        expect(fakeRetryable.retry._errors).toStrictEqual(new Set());
      });
    });

    describe('calling config functions once', () => {
      it('should update the config', () => {
        fakeRetryable.retry
          .times(10)
          .withIntervalsOf(2000)
          .withBackoffFactor(3)
          .ifItReturns(1)
          .ifItThrows(FakeErrorA);

        expect(fakeRetryable.retry._times).toEqual(10);
        expect(fakeRetryable.retry._intervalMillis).toEqual(2000);
        expect(fakeRetryable.retry._backoffFactor).toEqual(3);
        expect(fakeRetryable.retry._returnedValues).toEqual(new Set([1]));
        expect(fakeRetryable.retry._errors).toStrictEqual(new Set([FakeErrorA]));
      });
    });

    describe('calling config functions twice', () => {
      it('should take the last value in case of duplicate settings', () => {
        fakeRetryable.retry
          .times(10)
          .times(5)
          .withIntervalsOf(2000)
          .withIntervalsOf(3000)
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
        expect(fakeRetryable.retry._errors).toStrictEqual(new Set([FakeErrorA, FakeErrorB]));
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
        expect(fakeRetryable.retry._errors).toStrictEqual(new Set([FakeErrorA, FakeErrorB]));
      });
    });
  });

  describe('retry execution', () => {
    describe('callback function succeeded on first try', () => {
      describe('callback is an async function with arguments', () => {
        it('should return the callback returned value', async () => {
          const fakeAsyncCallbackFunc = jest.fn(
            async (x: number, y: number): Promise<string> => `test ${x}, ${y}`
          );
          const fakeRetryable = new Retryable(fakeAsyncCallbackFunc);
          fakeRetryable.retry.times(3);

          expect(fakeRetryable.run(1, 2)).resolves.toEqual('test 1, 2');
          expect(fakeAsyncCallbackFunc).toHaveBeenCalledTimes(1);
        });
      });

      describe('callback is a sync function with arguments', () => {
        it('should return the callback returned value', async () => {
          const fakeSyncCallbackFunc = jest.fn((x: number, y: number): string => `test ${x}, ${y}`);
          const fakeRetryable = new Retryable(fakeSyncCallbackFunc);
          fakeRetryable.retry.times(3);

          expect(await fakeRetryable.run(1, 2)).toEqual('test 1, 2');
          expect(fakeSyncCallbackFunc).toHaveBeenCalledTimes(1);
        });
      });

      describe('callback is an async function without arguments', () => {
        it('should return the callback returned value', async () => {
          const fakeAsyncCallbackFunc = jest.fn(async (): Promise<string> => 'test');
          const fakeRetryable = new Retryable(fakeAsyncCallbackFunc);
          fakeRetryable.retry.times(3);

          expect(fakeRetryable.run()).resolves.toEqual('test');
          expect(fakeAsyncCallbackFunc).toHaveBeenCalledTimes(1);
        });
      });

      describe('callback is a sync function without arguments', () => {
        it('should return the callback returned value', async () => {
          const fakeSyncCallbackFunc = jest.fn((): string => 'test');
          const fakeRetryable = new Retryable(fakeSyncCallbackFunc);
          fakeRetryable.retry.times(3);

          expect(await fakeRetryable.run()).toEqual('test');
          expect(fakeSyncCallbackFunc).toHaveBeenCalledTimes(1);
        });
      });

      describe('callback is a sync function with no return value (void)', () => {
        it('should return the callback returned value', async () => {
          const fakeSyncCallbackFunc = jest.fn((): void => {});
          const fakeRetryable = new Retryable(fakeSyncCallbackFunc);
          fakeRetryable.retry.times(3);

          expect(await fakeRetryable.run()).toEqual(undefined);
          expect(fakeSyncCallbackFunc).toHaveBeenCalledTimes(1);
        });
      });
    });

    describe('callback function triggers are set and met', () => {
      describe('callback function succeeded on the 5th try out of 5', () => {
        it('should return the callback returned value, and store trigger history', async () => {
          const fakeSyncCallbackFunc = jest.fn();

          // the first 4 mocks will make the function being retried by Retryable object
          fakeSyncCallbackFunc
            .mockReturnValueOnce(0)
            .mockImplementationOnce(() => {
              throw new FakeErrorA();
            })
            .mockReturnValueOnce(NaN)
            .mockImplementationOnce(() => {
              throw new FakeErrorB();
            })
            .mockReturnValueOnce(10);

          const fakeRetryable = new Retryable(fakeSyncCallbackFunc);

          // set 4 triggers for retry, 2 for values, and another 2 for exceptions,
          // in order to trigger a retry in the mock values above
          fakeRetryable.retry
            .times(5)
            .withIntervalsOf(1500)
            .ifItReturns(0)
            .ifItThrows(FakeErrorA)
            .ifItReturns(NaN)
            .ifItThrows(FakeErrorB);

          expect(await fakeRetryable.run()).toEqual(10);
          expect(fakeSyncCallbackFunc).toHaveBeenCalledTimes(5);
          expect(mockedSleep).toHaveBeenCalledTimes(4);
          for (let nthCall = 1; nthCall < 5; nthCall++) {
            expect(mockedSleep).toHaveBeenNthCalledWith(nthCall, 1500);
          }
        });
      });

      describe('sync callback function failed on all tries', () => {
        it('should throw', async () => {
          const fakeSyncCallbackFunc = jest.fn();
          fakeSyncCallbackFunc
            .mockImplementationOnce(() => {
              throw new FakeErrorA();
            })
            .mockImplementationOnce(() => {
              throw new FakeErrorB();
            })
            .mockReturnValueOnce(0);

          const fakeRetryable = new Retryable(fakeSyncCallbackFunc);

          fakeRetryable.retry.times(3).ifItThrows(FakeErrorA).ifItReturns(0).ifItThrows(FakeErrorB);

          let exp;
          try {
            await fakeRetryable.run();
          } catch (e) {
            exp = e;
          }

          // make sure that the callback function was called no
          // more than the number of retries allowed
          expect(fakeSyncCallbackFunc).toHaveBeenCalledTimes(3);
          expect(exp.data).toStrictEqual({
            retryConfig: {
              times: 3,
              intervalMillis: 1000,
              backoffFactor: 1,
            },
            triggersHistory: {
              returnedValues: [0],
              exceptionsThrown: [new FakeErrorA(), new FakeErrorB()],
            },
          });
          expect(mockedSleep).toHaveBeenCalledTimes(3);
        });
      });

      describe('async callback function failed on all tries', () => {
        it('should throw', async () => {
          const fakeAsyncCallbackFunc = jest.fn();
          fakeAsyncCallbackFunc.mockResolvedValue(0);

          const fakeRetryable = new Retryable(fakeAsyncCallbackFunc);

          fakeRetryable.retry.times(3).ifItReturns(0);

          let exp;
          try {
            await fakeRetryable.run();
          } catch (e) {
            exp = e;
          }

          // make sure that the callback function was called no
          // more than the number of retries allowed
          expect(fakeAsyncCallbackFunc).toHaveBeenCalledTimes(3);
          expect(exp.data).toStrictEqual({
            retryConfig: {
              times: 3,
              intervalMillis: 1000,
              backoffFactor: 1,
            },
            triggersHistory: {
              returnedValues: [0, 0, 0],
              exceptionsThrown: [],
            },
          });
          expect(mockedSleep).toHaveBeenCalledTimes(3);
        });
      });
    });

    describe('callback function triggers are set but never met', () => {
      it('should not retry for exception different than the trigger set', async () => {
        const fakeAsyncCallbackFunc = jest.fn();

        fakeAsyncCallbackFunc.mockImplementationOnce(() => {
          throw new FakeErrorB();
        });

        const fakeRetryable = new Retryable(fakeAsyncCallbackFunc);

        // set triggers that are different from the mock defined above
        fakeRetryable.retry.times(3).ifItThrows(FakeErrorA);

        let exp;
        try {
          await fakeRetryable.run();
        } catch (e) {
          exp = e;
        }

        // make sure the callback function was called only once (no retries)
        expect(fakeAsyncCallbackFunc).toHaveBeenCalledTimes(1);
        expect(mockedSleep).toHaveBeenCalledTimes(0);
        expect(exp).toBeInstanceOf(FakeErrorB);
      });
    });

    it('should not retry for value different than the trigger set', async () => {
      const fakeAsyncCallbackFunc = jest.fn();

      fakeAsyncCallbackFunc.mockResolvedValueOnce(1);

      const fakeRetryable = new Retryable(fakeAsyncCallbackFunc);

      // set triggers that are different from the mock defined above
      fakeRetryable.retry.times(3).ifItReturns(0);

      await fakeRetryable.run();

      // make sure the callback function was called only once (no retries)
      expect(fakeAsyncCallbackFunc).toHaveBeenCalledTimes(1);
      expect(mockedSleep).toHaveBeenCalledTimes(0);
    });
  });

  describe('retry triggers', () => {
    it('should be able to detect different exception triggers', () => {});

    it('should be able to detect different value triggers', () => {});
  });

  describe('interval with backoff factor of 2', () => {
    it('should multiply interval time by 2 for every callback failure', async () => {
      const fakeSyncCallbackFunc = jest.fn();
      fakeSyncCallbackFunc.mockImplementation(() => {
        throw new FakeErrorA();
      });

      const fakeRetryable = new Retryable(fakeSyncCallbackFunc);

      fakeRetryable.retry.times(3).withBackoffFactor(2).ifItThrows(FakeErrorA);

      let exp;
      try {
        await fakeRetryable.run();
      } catch (e) {
        exp = e;
      }

      // ensure that for each retry a backoff factor of 2 is applied
      expect(mockedSleep).toHaveBeenCalledTimes(3);
      expect(mockedSleep).toHaveBeenNthCalledWith(1, 1000);
      expect(mockedSleep).toHaveBeenNthCalledWith(2, 2000);
      expect(mockedSleep).toHaveBeenNthCalledWith(3, 4000);

      expect(exp.data).toStrictEqual({
        retryConfig: {
          times: 3,
          intervalMillis: 1000,
          backoffFactor: 2,
        },
        triggersHistory: {
          returnedValues: [],
          exceptionsThrown: [new FakeErrorA(), new FakeErrorA(), new FakeErrorA()],
        },
      });
    });
  });
});
