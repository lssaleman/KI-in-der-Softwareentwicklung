export interface EvalTask {
  id: string;
  startRef: string;
  budgetMinutes: number;
  promptFile: string;
  checkFile: string;
}

export const TASKS: EvalTask[] = [
    {
    id: "startseite",
    startRef: "vl08",
    budgetMinutes: 40,
    promptFile: "evals/tasks/startseite/prompt.md",
    checkFile: "evals/tasks/startseite/check.test.ts",
  },
];