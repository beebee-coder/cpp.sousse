
/**
 * @fileOverview Flux d'analyse visuelle pour le contrôle industriel.
 * Version : Consommée par API Route (sans 'use server').
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VisionAssistantDescriptionInputSchema = z.object({
  photoDataUri: z
    .string()
    .describe(
      "A photo or video frame, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    )
});
export type VisionAssistantDescriptionInput = z.infer<
  typeof VisionAssistantDescriptionInputSchema
>;

const VisionAssistantDescriptionOutputSchema = z.object({
  description: z
    .string()
    .describe('A detailed description of the visual content.'),
  categories: z
    .array(z.string())
    .describe('A list of general categories for the visual content.'),
  objects: z
    .array(z.string())
    .describe('A list of specific objects identified in the visual content.'),
});
export type VisionAssistantDescriptionOutput = z.infer<
  typeof VisionAssistantDescriptionOutputSchema
>;

export async function visionAssistantDescription(
  input: VisionAssistantDescriptionInput
): Promise<VisionAssistantDescriptionOutput> {
  return visionAssistantDescriptionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'visionAssistantDescriptionPrompt',
  input: {schema: VisionAssistantDescriptionInputSchema},
  output: {schema: VisionAssistantDescriptionOutputSchema},
  prompt: `You are an expert visual analysis assistant for industrial control systems.

Analyze the provided image or video frame and generate a detailed description of its content.
Additionally, identify and categorize all visible objects that are relevant to an industrial setting.

Provide your response in JSON format according to the output schema. Ensure the description is comprehensive, and the categories and objects lists are specific and accurate.

Image: {{media url=photoDataUri}}`,
  config: {
    model: 'googleai/gemini-1.5-flash',
    responseModalities: ['TEXT'],
  },
});

const visionAssistantDescriptionFlow = ai.defineFlow(
  {
    name: 'visionAssistantDescriptionFlow',
    inputSchema: VisionAssistantDescriptionInputSchema,
    outputSchema: VisionAssistantDescriptionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output) {
      throw new Error('Failed to get a valid output from the AI model.');
    }
    return output;
  }
);
