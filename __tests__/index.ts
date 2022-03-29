import {Nib, nib, get, set} from '../src/index'
import type {Get} from '../src/index'

describe('nib', () => {
  it('is a factory function for Nib', () => {
    const s = nib('foo')
    expect(s).toBeInstanceOf(Nib)
    expect(s).toStrictEqual(new Nib('foo'))
  })

  it('has nib.get/nib.set funtions', () => {
    expect(nib.get).toStrictEqual(nib.get)
    expect(nib.set).toStrictEqual(nib.set)
  })

  describe('((type checks))', () => {
    // @ts-expect-error cast as number but given string
    nib<number>('foo')

    const s = nib('foo')
    s.value = 'bar'

    // @ts-expect-error conflicting type as s is Nib<string>
    s.value = 1
  })
})

describe('get/set', () => {

  it('gets/sets a nib value', () => {
    const s = nib('foo')
    expect(nib.get(s)).toStrictEqual('foo')
    nib.set(s, 'bar')
    expect(nib.get(s)).toStrictEqual('bar')
    set(s, 'baz')
    expect(get(s)).toStrictEqual('baz')
  })

})

describe('Nib', () => {
  it('has static get/set members', () => {
    expect(Nib.get).toStrictEqual(nib.get)
    expect(Nib.set).toStrictEqual(nib.set)
  })

  it('creates a new Nib object with a value getter/setter', () => {
    const s = nib('foo')
    expect(s.value).toBe('foo')
    s.value = 'bar'
    expect(s.value).toBe('bar')
  })

  it('creates unique values', () => {
    const makeS = () => nib('foo')
    const xs = [makeS(), makeS(), makeS()]
    expect(xs.map(x => x.value)).toStrictEqual(['foo', 'foo', 'foo'])
    xs[1].value = 'bar'
    expect(xs.map(x => x.value)).toStrictEqual(['foo', 'bar', 'foo'])
  })

  it('exposes an async iterator', async () => {
    const s = nib('foo')
    for await (const v of s) {
      expect(v).toBe('foo')
      break
    }
  })

  it('exposes a map method that returns derived values', async () => {
    const s = nib<string>('foo')
    const l = s.map((x: string) => x.length)
    expect(l.value).toBe(3)
    s.value = 'bing'
    expect(l.value).toBe(4)
  })

  it('can be iterated asynchronously', async () => {
    const s = nib<string>('foo')
    setTimeout(() => (s.value = 'bar'), 10)
    setTimeout(() => (s.value = 'baz'), 20)
    setTimeout(() => (s.value = 'bing'), 30)
    const values = []
    for await (const v of s) {
      values.push(v)
      if (v === 'bing') break
    }
    s.value = 'bong'
    expect(values).toStrictEqual(['foo', 'bar', 'baz', 'bing'])
  })

  describe('((types))', () => {
    // @ts-expect-error cast as number but given string
    nib<number>('foo')
  })

  describe('composition', () => {
    it('can be used to derive Nib from other fields', () => {
      const word = nib<string>('foo')
      const len = nib<number>((get: Get) => get(word).length)
      const caps = nib<string>((get: Get) => get(word).toUpperCase())
      expect(word.value).toBe('foo')
      expect(len.value).toBe(3)
      expect(caps.value).toBe('FOO')
      word.value = 'bing'
      expect(word.value).toBe('bing')
      expect(len.value).toBe(4)
      expect(caps.value).toBe('BING')
    })

    it('can compose async', async () => {
      const word = nib<string>('foo')
      const wordLater = nib<Promise<string>>(async (get: Get) => get(word))
      const wordEvenLater = nib<Promise<string>>(async (get: Get) => get(wordLater))
      expect(word.value).toBe('foo')
      expect(wordLater.value).toBeInstanceOf(Promise)
      expect(wordEvenLater.value).toBeInstanceOf(Promise)
      expect(await wordLater.value).toBe('foo')
      expect(await wordEvenLater.value).toBe('foo')
      word.value = 'bar'
      expect(wordLater.value).toBeInstanceOf(Promise)
      expect(await wordLater.value).toBe('bar')
      expect(await wordEvenLater.value).toBe('bar')
    })

    it('only calls when dependencies update', () => {
      let c = 0
      const first = nib<string>('foo')
      const second = nib<string>('bar')
      const both = nib((get: Get) => (c += 1) + get(first) + get(second))
      expect(both.value).toBe('1foobar')
      first.value = 'baz'
      expect(both.value).toBe('2bazbar')
      second.value = 'bing'
      expect(both.value).toBe('3bazbing')
      first.value = 'foo'
      second.value = 'bar'
      expect(both.value).toBe('5foobar')
    })

    describe('((types))', () => {
      const string = nib<string>('foo')
      const number = nib<number>(1)
      nib<boolean>((get: Get) => {
        return get(string) + get(number)
      })
    })
  })

  describe('README example', () => {
    type Person = {givenName: string}
    const db: Person[] = [
      {givenName: 'Aki'},
      {givenName: 'Alex'},
      {givenName: 'Ali'},
      {givenName: 'Azriel'},
      {givenName: 'Baily'},
      {givenName: 'Byrd'},
      {givenName: 'Bo'},
      {givenName: 'Brit'},
      {givenName: 'Bernie'}
    ]

    async function contrivedFetch(url: string) {
      const initial = new URL(url, 'https://example.com').searchParams.get('initials')
      return {
        async json() {
          return {data: {people: db.filter(p => p.givenName[0] === initial)}}
        }
      }
    }

    it('allows composition of complex asynchronous state', async () => {
      const initials = nib<string>('A')
      const url = nib<string>(get => `https://example.com/api/people.json?initials=${get(initials)}`)
      const people = nib<Promise<Person[]>>(async get => {
        const res = await contrivedFetch(get(url))
        const json = await res.json()
        return json.data.people
      })
      const givenNames = nib<Promise<string[]>>(async get => {
        const results = await get(people)
        return results.map((person: Person) => person.givenName)
      })
      const peopleCount = nib<Promise<number>>(async get => {
        const results = await get(people)
        return results.length
      })
      expect(await givenNames.value).toStrictEqual(['Aki', 'Alex', 'Ali', 'Azriel'])
      expect(await peopleCount.value).toStrictEqual(4)
      initials.value = 'B'
      expect(await givenNames.value).toStrictEqual(['Baily', 'Byrd', 'Bo', 'Brit', 'Bernie'])
      expect(await peopleCount.value).toStrictEqual(5)
    })
  })

  describe('ToDo Example', () => {
    type Todo = Nib<{title: string; done: boolean}>
    let filter: Nib<'all' | 'incomplete' | 'complete'>
    let todos: Nib<Todo[]>
    let filtered: Nib<Todo[]>
    function add(title: string, done = false) {
      const todo = nib({title, done})
      todos.value = [...todos.value, todo]
      return todo
    }
    function remove(todo: Todo) {
      todos.value = todos.value.filter(t => t !== todo)
    }
    function toggle(todo: Todo) {
      todo.value = {...todo.value, done: !todo.value.done}
    }
    beforeEach(() => {
      filter = nib<'all' | 'incomplete' | 'complete'>('all')
      todos = nib<Todo[]>([])
      filtered = nib<Todo[]>((get: Get) => {
        if (get(filter) === 'incomplete') {
          return get(todos).filter((todo: Todo) => !get(todo).done)
        } else if (get(filter) === 'complete') {
          return get(todos).filter((todo: Todo) => get(todo).done)
        }
        return get(todos)
      })
    })

    it('reacts to new todos being added and removed', () => {
      const todo = add('foo')
      expect(todos.value.map(s => s.value)).toStrictEqual([{title: 'foo', done: false}])
      remove(todo)
      expect(todos.value.map(s => s.value)).toStrictEqual([])
    })

    it('reacts to changes to filter Nib', () => {
      add('foo')
      add('bar', true)
      add('baz')
      add('bing', true)
      expect(filtered.value.map(s => s.value.title)).toStrictEqual(['foo', 'bar', 'baz', 'bing'])
      filter.value = 'complete'
      expect(filtered.value.map(s => s.value.title)).toStrictEqual(['bar', 'bing'])
      filter.value = 'incomplete'
      expect(filtered.value.map(s => s.value.title)).toStrictEqual(['foo', 'baz'])
    })

    it('reacts to changes to todo Nib', () => {
      filter.value = 'complete'
      add('foo')
      add('bar', true)
      const baz = add('baz')
      const bing = add('bing', true)
      filter.value = 'complete'
      expect(filtered.value.map(s => s.value.title)).toStrictEqual(['bar', 'bing'])
      toggle(baz)
      expect(filtered.value.map(s => s.value.title)).toStrictEqual(['bar', 'baz', 'bing'])
      toggle(bing)
      expect(filtered.value.map(s => s.value.title)).toStrictEqual(['bar', 'baz'])
    })
  })
})
