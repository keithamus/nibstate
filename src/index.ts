// The `Get` type is a function that is passed to the Nib initializer
export type Get<T = any, S extends Nib<T> = Nib<T>> = (s: S) => S extends Nib<infer I> ? I : never

interface PrivateState<T> {
  v: T
  n: Set<(v: T) => void>
}

const states = new WeakMap<Nib<unknown>, PrivateState<unknown>>()
export class Nib<T> implements AsyncIterable<T> {
  constructor(init: T | ((get: Get<any>) => T)) {
    states.set(this, {v: init, n: new Set()})
    if (typeof init === 'function') {
      const clears = new Set<() => void>()
      const next = () => {
        for (const clear of clears) clear()
        this.value = (init as (get: Get<any>) => T)(track)
      }
      const track: Get<any> = (s: Nib<T>): T => {
        s.next(next)
        return s.value
      }
      next()
    } else {
      this.value = init
    }
  }

  get value(): T {
    return (states.get(this) as PrivateState<T>).v
  }

  set value(value: T) {
    const state = states.get(this) as PrivateState<T>
    if (Object.is(state.v, value)) return
    state.v = value
    const pastNexts = state.n
    state.n = new Set()
    for (const next of pastNexts) next(value)
  }

  next(fn: (v: T) => void): () => void {
    const state = states.get(this) as PrivateState<T>
    state.n.add(fn)
    return () => state.n.delete(fn)
  }

  map<B>(fn: (v: T) => B): Nib<B> {
    return new Nib((g: Get) => fn(g(this)))
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    yield this.value
    while (true) {
      yield await new Promise(r => this.next(r))
    }
  }

  static get<T>(x: Nib<T>): T {
    return x.value
  }

  static set<T>(x: Nib<T>, value: T): void {
    x.value = value
  }
}

export function nib<T>(init: T | ((get: Get<any>) => T)): Nib<T> {
  return new Nib(init)
}
export const set = (nib.set = Nib.set)
export const get = (nib.get = Nib.get)
