export type EvalTask = {
  id: string
  size: 'S' | 'M' | 'L'
  start: string
  minutes: number
  check: { hidden: true } | { hidden: false; files: string[] }
}

export const TASKS: EvalTask[] = [
  {
    id: "helloworld",
    size: "S",
    start: "tests-startzustand",
    minutes: 3,
    check: {
      hidden: true
    }
  },
  {
    id: "rotation",
    size: "M",
    start: "tests-startzustand",
    minutes: 15,
    check: {
      hidden: true
    }
  }
];