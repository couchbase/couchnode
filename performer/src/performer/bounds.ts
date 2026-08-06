import {
  Counter as CounterPb,
  CounterGlobal as CounterGlobalPb,
} from "../proto/shared.bounds_pb";

interface BoundsExecutor {
  canExecute(): boolean;
}

class CounterBoundsExecutor implements BoundsExecutor {
  counter: Counter;

  constructor(counter: Counter) {
    this.counter = counter;
  }

  canExecute(): boolean {
    return this.counter.getAndDecrement() >= 0;
  }
}

class CounterEqualsBoundsExecutor implements BoundsExecutor {
  counter: Counter;
  initial_counter_value: number;

  constructor(counter: Counter) {
    const initial_value = counter.get();
    this.counter = counter;
    this.initial_counter_value = initial_value;
  }

  canExecute(): boolean {
    return this.counter.get() == this.initial_counter_value;
  }
}

class TimeBoundsExecutor implements BoundsExecutor {
  deadline: number;

  constructor(deadline: number) {
    this.deadline = deadline;
  }

  canExecute(): boolean {
    return Date.now() < this.deadline;
  }
}

class Counter {
  count: number;

  constructor(initCount: number) {
    this.count = initCount;
  }

  getAndIncrement(): number {
    this.count += 1;
    return this.count;
  }

  getAndDecrement(): number {
    this.count -= 1;
    return this.count;
  }

  get(): number {
    return this.count;
  }
}

class Counters {
  counters: { [counterId: string]: Counter } = {};

  get(sharedCounter: CounterPb): Counter {
    if (!sharedCounter.hasGlobal())
      throw new Error("Unimplemented counter type");
    const global = sharedCounter.getGlobal() as CounterGlobalPb;

    if (sharedCounter.getCounterId() in this.counters) {
      return this.counters[sharedCounter.getCounterId()];
    }

    const initValue = global.getCount();
    const counter = new Counter(initValue);
    this.counters[sharedCounter.getCounterId()] = counter;

    return counter;
  }

  set(sharedCounter: CounterPb): void {
    if (!sharedCounter.hasGlobal())
      throw new Error("Unimplemented counter type");
    const global = sharedCounter.getGlobal() as CounterGlobalPb;

    const initValue = global.getCount();
    if (sharedCounter.getCounterId() in this.counters) {
      this.counters[sharedCounter.getCounterId()].count = initValue;
    } else {
      this.counters[sharedCounter.getCounterId()] = new Counter(initValue);
    }
  }

  clear(): void {
    this.counters = {};
  }
}

export {
  Counter,
  Counters,
  BoundsExecutor,
  CounterBoundsExecutor,
  CounterEqualsBoundsExecutor,
  TimeBoundsExecutor,
};
