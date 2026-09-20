/**
 * 동시 실행 개수를 제한하는 작업 대기열.
 * 사업계획서 만들기에서 공공데이터 호출을 동시에 최대 limit개(기본 4)까지만 보낸다.
 * 작업은 넣은 순서대로 시작하고, 하나가 끝나면 다음 작업을 시작한다.
 */

/** 대기열 */
export interface Queue {
  /** 작업을 넣는다. 작업이 끝나면(성공 · 실패 모두) 결과 Promise가 풀린다 */
  add<T>(job: () => Promise<T>): Promise<T>;
  /** 지금 실행 중인 작업 수 */
  running(): number;
  /** 기다리는 작업 수 */
  waiting(): number;
  /** 기다리는 작업을 모두 "취소됨"으로 실패시킨다 (실행 중인 작업은 그대로 끝난다) */
  clear(): void;
}

/** 취소된 작업의 오류 메시지 */
export const CANCELLED = "취소됨";

/** limit개까지 동시에 실행하는 대기열을 만든다 */
export function createQueue(limit = 4): Queue {
  let active = 0;
  const pending: { start: () => void; cancel: () => void }[] = [];

  /** 자리가 있으면 다음 작업을 시작한다 */
  const next = () => {
    while (active < limit && pending.length > 0) {
      const item = pending.shift()!;
      active += 1;
      item.start();
    }
  };

  return {
    add<T>(job: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        pending.push({
          start: () => {
            job()
              .then(resolve, reject)
              .finally(() => {
                active -= 1;
                next();
              });
          },
          cancel: () => reject(new Error(CANCELLED)),
        });
        next();
      });
    },
    running: () => active,
    waiting: () => pending.length,
    clear: () => {
      for (const item of pending.splice(0)) item.cancel();
    },
  };
}
