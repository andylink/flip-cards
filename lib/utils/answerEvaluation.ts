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

const CLOZE_TOKEN_REGEX = /{{\s*(blank|[1-9]\d*)\s*}}/gi;

export const dropdownSchema = z.object({
  questions: z.array(
    z.object({
      prompt: z.string(),
      options: z.array(z.string()).min(2),
      correctIndex: z.number().int().min(0)
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
          correctIndex: z.number().int().min(0)
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
  return Array.from(template.matchAll(CLOZE_TOKEN_REGEX)).map((token) => token[0]);
}

export function clozePlaceholderIds(template: string): number[] {
  const matches = Array.from(template.matchAll(CLOZE_TOKEN_REGEX));
  const orderedUniqueIds: number[] = [];
  const seen = new Set<number>();
  let nextLegacyId = 1;

  for (const match of matches) {
    const raw = (match[1] ?? '').toLowerCase();
    const id = raw === 'blank' ? nextLegacyId++ : Number(raw);
    if (!Number.isInteger(id) || id <= 0) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    orderedUniqueIds.push(id);
  }

  return orderedUniqueIds;
}
