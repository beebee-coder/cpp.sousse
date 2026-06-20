
/**
 * @fileOverview Flux de récupération de documents RAG basé sur une image.
 * Version : Consommée par API Route (sans 'use server').
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const DocumentSchema = z.object({
  title: z.string().describe('The title of the technical document.'),
  summary: z.string().describe('A brief summary of the document content.'),
  url: z.string().url().describe('The URL to access the full document.'),
});

const VisualDocumentRetrievalInputSchema = z.object({
  imageDataUri: z
    .string()
    .describe(
      "An image of a component or system, as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
});
export type VisualDocumentRetrievalInput = z.infer<typeof VisualDocumentRetrievalInputSchema>;

const VisualDocumentRetrievalOutputSchema = z.object({
  componentDescription: z.string().describe('A brief description of the identified component or system.'),
  relevantDocuments: z
    .array(DocumentSchema)
    .describe('A list of technical documents relevant to the identified component.'),
});
export type VisualDocumentRetrievalOutput = z.infer<typeof VisualDocumentRetrievalOutputSchema>;

const getDocumentInformationTool = ai.defineTool(
  {
    name: 'getDocumentInformation',
    description: 'Retrieves relevant industrial technical documents based on a descriptive query.',
    inputSchema: z.object({
      query: z.string().describe('A descriptive query to search for industrial technical documents.'),
    }),
    outputSchema: z.array(DocumentSchema),
  },
  async (input) => {
    console.log(`Tool invoked: getDocumentInformation with query: "${input.query}"`);
    if (input.query.toLowerCase().includes('valve')) {
      return [
        {
          title: 'Industrial Valve Maintenance Guide',
          summary: 'Comprehensive guide for maintenance and troubleshooting of various industrial valves.',
          url: 'https://example.com/docs/valve_maintenance.pdf',
        },
        {
          title: 'Pressure Relief Valve Specifications',
          summary: 'Detailed specifications and datasheets for pressure relief valves.',
          url: 'https://example.com/docs/prv_specs.pdf',
        },
      ];
    } else if (input.query.toLowerCase().includes('pump')) {
      return [
        {
          title: 'Centrifugal Pump Operating Manual',
          summary: 'Instructions for operation, installation, and common issues for centrifugal pumps.',
          url: 'https://example.com/docs/pump_manual.pdf',
        },
        {
          title: 'Pump Seal Replacement Procedure',
          summary: 'Step-by-step guide for replacing pump seals in industrial applications.',
          url: 'https://example.com/docs/pump_seal_replacement.pdf',
        },
      ];
    } else {
      return [
        {
          title: 'General Industrial Component Handbook',
          summary: 'A broad overview of common industrial components and their functions.',
          url: 'https://example.com/docs/component_handbook.pdf',
        },
      ];
    }
  }
);

const visualDocumentRetrievalPrompt = ai.definePrompt({
  name: 'visualDocumentRetrievalPrompt',
  input: { schema: VisualDocumentRetrievalInputSchema },
  output: { schema: VisualDocumentRetrievalOutputSchema },
  tools: [getDocumentInformationTool],
  prompt: `You are an expert industrial technician assistant. Your task is to analyze the provided image of a component or system, identify it, and then use the available tools to retrieve relevant technical documents or schematics from the knowledge base.

First, describe the component or system you identify in the image concisely.
Second, formulate a precise query based on the identified component or system to search for technical documents. Use the getDocumentInformation tool with this query.
Finally, present the description of the component and the retrieved documents in the specified JSON format.

Image of component: {{media url=imageDataUri}}`,
  config: {
    model: 'googleai/gemini-1.5-flash',
  }
});

export async function visualDocumentRetrieval(input: VisualDocumentRetrievalInput): Promise<VisualDocumentRetrievalOutput> {
  return visualDocumentRetrievalFlow(input);
}

const visualDocumentRetrievalFlow = ai.defineFlow(
  {
    name: 'visualDocumentRetrievalFlow',
    inputSchema: VisualDocumentRetrievalInputSchema,
    outputSchema: VisualDocumentRetrievalOutputSchema,
  },
  async (input) => {
    const { output } = await visualDocumentRetrievalPrompt(input);
    if (!output) {
      throw new Error('Failed to retrieve relevant documents.');
    }
    return output;
  }
);
