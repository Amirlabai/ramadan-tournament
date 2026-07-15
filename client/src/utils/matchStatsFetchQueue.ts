/** Cap parallel match-stats GETs so Schedule/Dashboard in-view bars do not stampede. */
const MAX_CONCURRENT = 3;

let active = 0;
const waiting: Array<() => void> = [];

function pump(): void {
  while (active < MAX_CONCURRENT && waiting.length > 0) {
    const next = waiting.shift();
    if (next) next();
  }
}

export function enqueueMatchStatsFetch<T>(run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const start = () => {
      active += 1;
      run()
        .then(resolve, reject)
        .finally(() => {
          active -= 1;
          pump();
        });
    };

    if (active < MAX_CONCURRENT) {
      start();
    } else {
      waiting.push(start);
    }
  });
}
