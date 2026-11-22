export type EvalTask = {
  id: string
  size: 'S' | 'M' | 'L'
  start: string
  minutes: number
  check: { hidden: true } | { hidden: false; files: string[] }
}

export const TASKS: EvalTask[] = [
    {
    id: "startseite",
    size: "L",
    start: "startseite",
    minutes: 40,
    check: {
      hidden: false,
      files: ["evals/tasks/startseite/check.test.ts"]
    }
  }, {
    id: "impressum",
    size: "S",
    start: "startseite",
    minutes: 15,
    check: {
      hidden: false,
      files: ["evals/tasks/impressum/check.test.ts"]
    }
  },
];