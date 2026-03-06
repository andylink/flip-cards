import { AnswerType } from '@/lib/types/domain';
import { z } from 'zod';

export const freeFormSchema = z.object({
  accepted: z.array(z.string()).min(1),
  regex: z.string().optional(),
  trim: z.boolean().default(true),
  caseSensitive: z.boolean().default(false)
});

export const mcqSchema = z.object({
  choices: z.array(z.string()).min(2),
  correctIndex: z.number().int().min(0),
  shuffle: z.boolean().default(false)
});

export const clozeSchema = z.object({
  template: z.string(),
  blanks: z.array(
    z.object({
      accepted: z.array(z.string()).min(1)
    })
  )
});

const CLOZE_TOKEN_REGEX = /{{\s*([^{}]+?)\s*}}/g;

const LEGACY_CLOZE_PLACEHOLDER_REGEX = /^(blank|[1-9]\d*)$/i;

export type ClozePlaceholder = {
  token: string;
  value: string;
  start: number;
  end: number;
};

export const dropdownSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      options: z.array(z.string()).min(2),
      correctIndex: z.number().int().min(-1)
    })
  )
}).or(
  // Backward compatibility for older stored dropdown schemas.
  z
    .object({
      template: z.string(),
      blanks: z.array(
        z.object({
          options: z.array(z.string()).min(2),
          correctIndex: z.number().int().min(-1)
        })
      )
    })
    .transform((legacy) => ({
      questions: legacy.blanks.map((blank, index) => ({
        prompt: `Question ${index + 1}`,
        options: blank.options,
        correctIndex: blank.correctIndex
      }))
    }))
);

const normalize = (value: string, trim: boolean, caseSensitive: boolean) => {
  const nextValue = trim ? value.trim() : value;
  return caseSensitive ? nextValue : nextValue.toLowerCase();
};

export function evaluateAnswer(type: AnswerType, schemaJson: unknown, responseJson: unknown): boolean {
  switch (type) {
    case 'freeform': {
      const schema = freeFormSchema.parse(schemaJson);
      const response = z.object({ value: z.string() }).parse(responseJson);
      const responseValue = normalize(response.value, schema.trim, schema.caseSensitive);

      if (schema.regex) {
        const flags = schema.caseSensitive ? '' : 'i';
        const regex = new RegExp(schema.regex, flags);
        if (regex.test(response.value)) return true;
      }

      return schema.accepted
        .map((value) => normalize(value, schema.trim, schema.caseSensitive))
        .includes(responseValue);
    }
    case 'mcq': {
      const schema = mcqSchema.parse(schemaJson);
      const response = z.object({ selectedIndex: z.number().int() }).parse(responseJson);
      return response.selectedIndex === schema.correctIndex;
    }
    case 'dropdown': {
      const schema = dropdownSchema.parse(schemaJson);
      const response = z.object({ indices: z.array(z.number().int()) }).parse(responseJson);
      return schema.questions.every((question, index) => response.indices[index] === question.correctIndex);
    }
    case 'cloze': {
      const schema = clozeSchema.parse(schemaJson);
      const response = z.object({ values: z.array(z.string()) }).parse(responseJson);
      return schema.blanks.every((blank, index) => {
        const guess = response.values[index]?.trim().toLowerCase() ?? '';
        return blank.accepted.map((accepted) => accepted.trim().toLowerCase()).includes(guess);
      });
    }
    default:
      return false;
  }
}

export function clozeTokens(template: string): string[] {
  return clozePlaceholders(template).map((placeholder) => placeholder.token);
}

export function clozePlaceholders(template: string): ClozePlaceholder[] {
  const placeholders: ClozePlaceholder[] = [];

  for (const match of template.matchAll(CLOZE_TOKEN_REGEX)) {
    const token = match[0] ?? '';
    const value = (match[1] ?? '').trim();
    const start = match.index ?? 0;

    placeholders.push({
      token,
      value,
      start,
      end: start + token.length
    });
  }

  return placeholders;
}

const getClozePlaceholderDefaultAccepted = (value: string): string =>
  LEGACY_CLOZE_PLACEHOLDER_REGEX.test(value) ? '' : value;

export function hydrateClozeAcceptedByBlank(template: string, acceptedByBlank: string[]): string[] {
  const placeholders = clozePlaceholders(template);

  return placeholders.map((placeholder, index) => {
    const accepted = acceptedByBlank[index] ?? '';
    return accepted.trim() ? accepted : getClozePlaceholderDefaultAccepted(placeholder.value);
  });
}

export function remapClozeAcceptedByPlaceholder(
  previousTemplate: string,
  nextTemplate: string,
  previousAcceptedByBlank: string[]
): string[] {
  const previousPlaceholders = clozePlaceholders(previousTemplate);
  const nextPlaceholders = clozePlaceholders(nextTemplate);
  const acceptedQueuesByToken = new Map<string, string[]>();

  previousPlaceholders.forEach((placeholder, index) => {
    const key = placeholder.value.toLowerCase();
    const accepted = previousAcceptedByBlank[index] ?? '';
    const fallback = getClozePlaceholderDefaultAccepted(placeholder.value);
    const nextAccepted = accepted.trim() ? accepted : fallback;
    const queue = acceptedQueuesByToken.get(key);

    if (queue) {
      queue.push(nextAccepted);
      return;
    }

    acceptedQueuesByToken.set(key, [nextAccepted]);
  });

  return nextPlaceholders.map((placeholder) => {
    const key = placeholder.value.toLowerCase();
    const queue = acceptedQueuesByToken.get(key);
    if (queue && queue.length > 0) {
      return queue.shift() ?? '';
    }

    return getClozePlaceholderDefaultAccepted(placeholder.value);
  });
}
