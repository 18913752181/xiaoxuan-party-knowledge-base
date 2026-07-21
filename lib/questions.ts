import { promises as fs } from "fs";
import path from "path";

export type SubmittedQuestion = {
  id: string;
  question: string;
  submittedAt: string;
  answer: string;
  isPublic: boolean;
  status: "pending" | "processed";
  updatedAt: string;
  visitorAnswers: VisitorAnswer[];
};

export type VisitorAnswer = {
  id: string;
  content: string;
  submittedAt: string;
};

const questionsFile = path.join(process.cwd(), "data", "questions.json");

export async function listQuestions() {
  try {
    const content = await fs.readFile(questionsFile, "utf8");
    const rows = JSON.parse(content);
    return Array.isArray(rows) ? (rows as SubmittedQuestion[]).map((row) => ({ ...row, visitorAnswers: Array.isArray(row.visitorAnswers) ? row.visitorAnswers : [] })) : [];
  } catch {
    return [];
  }
}

async function saveQuestions(rows: SubmittedQuestion[]) {
  await fs.mkdir(path.dirname(questionsFile), { recursive: true });
  await fs.writeFile(questionsFile, `${JSON.stringify(rows, null, 2)}\n`, "utf8");
}

export async function createQuestion(question: string) {
  const now = new Date().toISOString();
  const row: SubmittedQuestion = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    question,
    submittedAt: now,
    answer: "",
    isPublic: false,
    status: "pending",
    updatedAt: now,
    visitorAnswers: []
  };
  const rows = await listQuestions();
  await saveQuestions([row, ...rows]);
  return row;
}

export async function addVisitorAnswer(questionId: string, content: string) {
  const rows = await listQuestions();
  const index = rows.findIndex((row) => row.id === questionId && row.isPublic);
  if (index < 0) return null;
  const answer: VisitorAnswer = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, content, submittedAt: new Date().toISOString() };
  rows[index] = { ...rows[index], visitorAnswers: [...rows[index].visitorAnswers, answer], updatedAt: new Date().toISOString() };
  await saveQuestions(rows);
  return { question: rows[index], answer };
}

export async function updateQuestion(id: string, patch: Pick<SubmittedQuestion, "answer" | "isPublic" | "status">) {
  const rows = await listQuestions();
  const index = rows.findIndex((row) => row.id === id);
  if (index < 0) return null;
  rows[index] = { ...rows[index], ...patch, updatedAt: new Date().toISOString() };
  await saveQuestions(rows);
  return rows[index];
}
