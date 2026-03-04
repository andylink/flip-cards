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

export const dropdownSchema = z.object({
  template: z.string(),
  blanks: z.array(
    z.object({
      options: z.array(z.string()).min(2),
      correctIndex: z.number().int().min(0)
    })
  )
});

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
      return schema.blanks.every((blank, index) => response.indices[index] === blank.correctIndex);
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
  return Array.from(template.matchAll(/{{\s*blank\s*}}/g)).map((token) => token[0]);
}
