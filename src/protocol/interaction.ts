export type QuestionAnswers = Record<string, string[]>;

export type InteractionResponse =
  | { kind: "approval"; optionId: string }
  | { kind: "question"; answers: QuestionAnswers }
  | { kind: "suggested_input"; outcome: "submitted"; text: string }
  | { kind: "suggested_input"; outcome: "dismissed" }
  | { kind: "cancelled" };
