import { Retryable } from '../src';
import { RetryableError } from '../src/errors/retryable-error';
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

    describe('setting jitter', () => {
      describe('valid range values', () => {
        it('should store the range', () => {
          const min = 0;
          const max = 1;

          fakeRetryable.retry.withJitter(min, max);

          expect(fakeRetryable.retry._jitter).toStrictEqual({
            min,
            max,
          });
        });
      });

      describe('invalid range values', () => {
        it('should throw and not store range', () => {
          const min = 1;
          const max = 0;

          expect(() => fakeRetryable.retry.withJitter(min, max)).toThrow(RetryableError);

          expect(fakeRetryable.retry._jitter).toStrictEqual({
            min: 0,
            max: 0,
          });
        });
      });
    });

    describe('setting retryable id', () => {
      it('should get stored', async () => {
        const fakeSyncCallbackFunc = jest.fn();
        const fakeRetryable = new Retryable(fakeSyncCallbackFunc, 'some-retryable-id');

        expect(fakeRetryable.id).toEqual('some-retryable-id');
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
          expect(fakeRetryable.attempts.length).toEqual(0);
        });
      });

      describe('callback is a sync function with arguments', () => {
        it('should return the callback returned value', async () => {
          const fakeSyncCallbackFunc = jest.fn((x: number, y: number): string => `test ${x}, ${y}`);
          const fakeRetryable = new Retryable(fakeSyncCallbackFunc);
          fakeRetryable.retry.times(3);

          expect(await fakeRetryable.run(1, 2)).toEqual('test 1, 2');
          expect(fakeSyncCallbackFunc).toHaveBeenCalledTimes(1);
          expect(fakeRetryable.attempts.length).toEqual(0);
        });
      });

      describe('callback is an async function without arguments', () => {
        it('should return the callback returned value', async () => {
          const fakeAsyncCallbackFunc = jest.fn(async (): Promise<string> => 'test');
          const fakeRetryable = new Retryable(fakeAsyncCallbackFunc);
          fakeRetryable.retry.times(3);

          expect(fakeRetryable.run()).resolves.toEqual('test');
          expect(fakeAsyncCallbackFunc).toHaveBeenCalledTimes(1);
          expect(fakeRetryable.attempts.length).toEqual(0);
        });
      });

      describe('callback is a sync function without arguments', () => {
        it('should return the callback returned value', async () => {
          const fakeSyncCallbackFunc = jest.fn((): string => 'test');
          const fakeRetryable = new Retryable(fakeSyncCallbackFunc);
          fakeRetryable.retry.times(3);

          expect(await fakeRetryable.run()).toEqual('test');
          expect(fakeSyncCallbackFunc).toHaveBeenCalledTimes(1);
          expect(fakeRetryable.attempts.length).toEqual(0);
        });
      });

      describe('callback is a sync function with no return value (void)', () => {
        it('should return the callback returned value', async () => {
          const fakeSyncCallbackFunc = jest.fn((): void => {});
          const fakeRetryable = new Retryable(fakeSyncCallbackFunc);
          fakeRetryable.retry.times(3);

          expect(await fakeRetryable.run()).toEqual(undefined);
          expect(fakeSyncCallbackFunc).toHaveBeenCalledTimes(1);
          expect(fakeRetryable.attempts.length).toEqual(0);
        });
      });
    });

    describe('callback function triggers are set and met', () => {
      describe('callback function succeeded on the 5th try out of 5', () => {
        it('should return the callback returned value, and store attempts history', async () => {
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
          expect(fakeRetryable.attempts.length).toEqual(4);
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
            id: undefined,
            retryConfig: expect.objectContaining({
              times: 3,
              intervalMillis: 1000,
              backoffFactor: 1,
            }),
            attempts: [
              { exceptionThrown: new FakeErrorA() },
              { exceptionThrown: new FakeErrorB() },
              { returnedValue: 0 },
            ],
          });
          expect(mockedSleep).toHaveBeenCalledTimes(3);
          expect(fakeRetryable.attempts.length).toEqual(3);
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
            id: undefined,
            retryConfig: expect.objectContaining({
              times: 3,
              intervalMillis: 1000,
              backoffFactor: 1,
            }),
            attempts: [{ returnedValue: 0 }, { returnedValue: 0 }, { returnedValue: 0 }],
          });
          expect(mockedSleep).toHaveBeenCalledTimes(3);
          expect(fakeRetryable.attempts.length).toEqual(3);
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
        expect(fakeRetryable.attempts.length).toEqual(0);
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
      expect(fakeRetryable.attempts.length).toEqual(0);
    });
  });

  describe('retry triggers', () => {
    describe('trigger set for superclass exception', () => {
      it('should be able to detect subclasses as the same exception trigger', async () => {
        class FakeErrorC extends Error {}

        const fakeCallbackFunc = jest.fn();
        fakeCallbackFunc.mockImplementationOnce(() => {
          throw new FakeErrorC();
        });

        const fakeRetryable = new Retryable(fakeCallbackFunc);
        fakeRetryable.retry.times(2).ifItThrows(Error);

        await fakeRetryable.run();

        // make sure retry was triggered once for the subclass error
        expect(fakeCallbackFunc).toHaveBeenCalledTimes(2);
        expect(mockedSleep).toHaveBeenCalledTimes(1);
        expect(fakeRetryable.attempts.length).toEqual(1);
        expect(fakeRetryable.attempts[0].exceptionThrown).toStrictEqual(new FakeErrorC());
      });
    });

    describe('trigger set for subclass exception', () => {
      it('should be able to distinguish b/w subclass and the parent superclass', async () => {
        class FakeErrorD extends Error {}

        const fakeCallbackFunc = jest.fn();
        fakeCallbackFunc.mockImplementationOnce(() => {
          throw new Error();
        });

        const fakeRetryable = new Retryable(fakeCallbackFunc);
        fakeRetryable.retry.times(2).ifItThrows(FakeErrorD);

        try {
          await fakeRetryable.run();
        } catch (e) {
          expect(e).toStrictEqual(new Error());
        }

        // make sure retry was not triggered for the superclass error
        expect(fakeCallbackFunc).toHaveBeenCalledTimes(1);
        expect(mockedSleep).toHaveBeenCalledTimes(0);
        expect(fakeRetryable.attempts.length).toEqual(0);
      });
    });

    it('should be able to detect different exception triggers', async () => {
      const fakeAsyncCallbackFunc = jest.fn();
      fakeAsyncCallbackFunc
        .mockImplementationOnce(() => {
          throw new FakeErrorA();
        })
        .mockImplementationOnce(() => {
          throw new FakeErrorB();
        })
        .mockReturnValue(0);

      const fakeRetryable = new Retryable(fakeAsyncCallbackFunc);

      fakeRetryable.retry.times(3).ifItThrows(FakeErrorB).ifItThrows(FakeErrorA);

      await fakeRetryable.run();

      // ensure retry was called for both exception triggers
      expect(fakeAsyncCallbackFunc).toHaveBeenCalledTimes(3);
      expect(mockedSleep).toHaveBeenCalledTimes(2);
      expect(fakeRetryable.attempts).toStrictEqual([
        { exceptionThrown: new FakeErrorA() },
        { exceptionThrown: new FakeErrorB() },
      ]);
    });

    it('should be able to detect different value triggers', async () => {
      const fakeAsyncCallbackFunc = jest.fn();
      fakeAsyncCallbackFunc.mockReturnValueOnce(12).mockResolvedValueOnce(-1).mockReturnValue(0);

      const fakeRetryable = new Retryable(fakeAsyncCallbackFunc);

      fakeRetryable.retry.times(3).ifItReturns(-1).ifItReturns(12);

      await fakeRetryable.run();

      // ensure retry was called for both value triggers
      expect(fakeAsyncCallbackFunc).toHaveBeenCalledTimes(3);
      expect(mockedSleep).toHaveBeenCalledTimes(2);
      expect(fakeRetryable.attempts).toStrictEqual([{ returnedValue: 12 }, { returnedValue: -1 }]);
    });
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

      expect(fakeRetryable.attempts.length).toEqual(3);

      expect(exp.data).toStrictEqual({
        id: undefined,
        retryConfig: expect.objectContaining({
          times: 3,
          intervalMillis: 1000,
          backoffFactor: 2,
        }),
        attempts: [
          { exceptionThrown: new FakeErrorA() },
          { exceptionThrown: new FakeErrorA() },
          { exceptionThrown: new FakeErrorA() },
        ],
      });
    });
  });

  describe('jitter range', () => {
    it('should add random jitter to interval', async () => {
      const fakeSyncCallbackFunc = jest.fn();
      fakeSyncCallbackFunc.mockImplementation(() => {
        throw new FakeErrorA();
      });

      const fakeRetryable = new Retryable(fakeSyncCallbackFunc);

      const maxJitter = 200;
      const minJitter = 100;
      fakeRetryable.retry.times(3).withJitter(minJitter, maxJitter).ifItThrows(FakeErrorA);

      let exp;
      try {
        await fakeRetryable.run();
      } catch (e) {
        exp = e;
      }

      expect(mockedSleep).toHaveBeenCalledTimes(3);

      // ensure that for each sleep a jitter in range was applied
      const defaultInterval = 1000;
      for (let nthCall = 0; nthCall < 3; nthCall++) {
        expect(mockedSleep.mock.calls[nthCall][0]).toBeGreaterThanOrEqual(
          defaultInterval + minJitter
        );
        expect(mockedSleep.mock.calls[nthCall][0]).toBeLessThanOrEqual(defaultInterval + maxJitter);
      }

      expect(fakeRetryable.attempts.length).toEqual(3);

      expect(exp.data).toStrictEqual({
        id: undefined,
        retryConfig: {
          times: 3,
          intervalMillis: 1000,
          backoffFactor: 1,
          jitter: {
            min: minJitter,
            max: maxJitter,
          },
        },
        attempts: [
          { exceptionThrown: new FakeErrorA() },
          { exceptionThrown: new FakeErrorA() },
          { exceptionThrown: new FakeErrorA() },
        ],
      });
    });
  });

  describe('invoking run function multiple times', () => {
    it('should clear the attempts history before each call', async () => {
      const fakeSyncCallbackFunc = jest.fn();
      fakeSyncCallbackFunc
        .mockImplementationOnce(() => {
          throw new FakeErrorA();
        })
        .mockReturnValueOnce(NaN)
        .mockReturnValue(1);

      const fakeRetryable = new Retryable(fakeSyncCallbackFunc);

      fakeRetryable.retry.times(3).ifItThrows(FakeErrorA).ifItReturns(NaN);

      // on the first run the first 2 attempts fail, and the third succeed.
      // so, the attempts data should include 2 attempts
      await fakeRetryable.run();

      expect(fakeRetryable.attempts.length).toEqual(2);

      // on the second run, the function return a valid value, so no attempts expected.
      // so, if attempts data is cleared, it should be empty
      await fakeRetryable.run();

      expect(fakeRetryable.attempts.length).toEqual(0);
    });

    it('should retry N times for each call', async () => {
      const fakeSyncCallbackFunc = jest.fn();

      const setCBFuncMock = () =>
        fakeSyncCallbackFunc
          .mockImplementationOnce(() => {
            throw new FakeErrorA();
          })
          .mockReturnValueOnce(NaN)
          .mockReturnValueOnce(1);

      setCBFuncMock();

      const fakeRetryable = new Retryable(fakeSyncCallbackFunc);

      fakeRetryable.retry.times(3).ifItThrows(FakeErrorA).ifItReturns(NaN);

      await fakeRetryable.run();

      expect(fakeRetryable.attempts.length).toEqual(2);
      expect(mockedSleep).toBeCalledTimes(2);

      fakeSyncCallbackFunc.mockClear();
      mockedSleep.mockClear();

      setCBFuncMock();

      await fakeRetryable.run();

      expect(fakeRetryable.attempts.length).toEqual(2);
      expect(mockedSleep).toBeCalledTimes(2);
    });
  });

  describe('retryable id was set', () => {
    it('should be part of the out-of-retries exception', async () => {
      const fakeSyncCallbackFunc = jest.fn();
      fakeSyncCallbackFunc
        .mockImplementationOnce(() => {
          throw new FakeErrorA();
        })
        .mockReturnValueOnce(NaN);

      const fakeRetryable = new Retryable(fakeSyncCallbackFunc, 'some-retryable-id');

      fakeRetryable.retry.times(2).ifItThrows(FakeErrorA).ifItReturns(NaN);

      let exp;
      try {
        await fakeRetryable.run();
      } catch (e) {
        exp = e;
      }

      expect(exp.data).toStrictEqual(expect.objectContaining({ id: 'some-retryable-id' }));
    });
  });
});
