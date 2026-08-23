export function createSequenceRandom(values, fallback = values.at(-1) ?? 0) {
  let index = 0;

  return {
    next() {
      const value = index < values.length ? values[index] : fallback;
      index += 1;
      return value;
    },
    get calls() {
      return index;
    },
  };
}
