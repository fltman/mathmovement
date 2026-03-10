/**
 * AI module - sends math book photos to OpenRouter API
 * for OCR and problem extraction.
 */

import { OPENROUTER_API_KEY } from './config.js';

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const API_KEY = OPENROUTER_API_KEY;
const MODEL = 'anthropic/claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a math problem extractor. You analyze photos of math textbook pages and extract addition and subtraction column arithmetic problems.

Rules:
- Only extract addition (+) and subtraction (-) problems
- Each problem has exactly 2 numbers
- Ignore any other content (text, images, etc.)
- Return ONLY valid JSON, no markdown, no explanation
- If you cannot find any problems, return an empty array []

Return format (JSON array):
[
  {"type": "addition", "numbers": [1234, 567]},
  {"type": "subtraction", "numbers": [8901, 2345]}
]

The first number in "numbers" is always the top number (the larger one for subtraction).
Only extract problems that are clearly column addition or subtraction (uppstallning/kolumnberakning).
If you see horizontal expressions like "3 + 5 = ?" - convert them to the same format.`;

export async function extractProblems(imageDataUrl, onStatus) {
  if (onStatus) onStatus('Skickar bilden till AI...');

  // Extract base64 from data URL
  const base64 = imageDataUrl.split(',')[1];
  const mimeType = imageDataUrl.split(';')[0].split(':')[1];

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': window.location.href,
        'X-Title': 'MatteRorelse',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`,
                },
              },
              {
                type: 'text',
                text: 'Extract all addition and subtraction problems from this math page. Return only JSON.',
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('API error:', errText);
      throw new Error(`API-fel: ${response.status}`);
    }

    if (onStatus) onStatus('Tolkar mattetal...');

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('Tomt svar från AI');
    }

    // Parse JSON from response (might be wrapped in ```json ... ```)
    let jsonStr = content.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```json?\s*/i, '').replace(/```\s*$/, '');
    }

    const problems = JSON.parse(jsonStr);

    if (!Array.isArray(problems)) {
      throw new Error('Oväntat svarsformat');
    }

    // Validate and clean problems
    const validProblems = problems.filter(p => {
      return (
        (p.type === 'addition' || p.type === 'subtraction') &&
        Array.isArray(p.numbers) &&
        p.numbers.length === 2 &&
        p.numbers.every(n => typeof n === 'number' && Number.isInteger(n) && n >= 0)
      );
    });

    // Ensure subtraction has larger number first
    validProblems.forEach(p => {
      if (p.type === 'subtraction' && p.numbers[0] < p.numbers[1]) {
        p.numbers = [p.numbers[1], p.numbers[0]];
      }
    });

    return validProblems;
  } catch (err) {
    console.error('extractProblems error:', err);
    throw err;
  }
}
