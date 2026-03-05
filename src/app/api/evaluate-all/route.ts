import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { z } from 'zod';

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
});

const PlayerSchema = z.object({
    name: z.string(),
    role: z.string(),
    matches: z.number(),
    runs: z.number().default(0),
    strikeRate: z.number().default(0.0),
    wickets: z.number().default(0),
    economy: z.number().default(0.0),
    pricePaidCr: z.number(),
});

const InputSchema = z.object({
    teams: z.record(z.string(), z.array(PlayerSchema)),
});

const systemPrompt = `You are a ruthless but fair T20 cricket analyst and IPL draft judge. You will receive a JSON object containing multiple drafted squads (specifically their chosen starting 11s), including their historical T20 stats and the auction price paid in Crores.

Evaluate each team based on:
    - Batting Firepower: Look for high strike rates (>140) and run volume.
    - Bowling Economy: Look for bowlers with high wicket counts and economies under 8.5.
    - Squad Balance: Ensure they have a proper mix of batters, all-rounders, and bowlers.
    - Value for Money: Heavily penalize the team's score if they spent massive amounts on average players.

Compare the teams against each other. Assign a rank to each team based on their relative strength (1 being the best).
    
You MUST output your response strictly in JSON format without any markdown formatting or introductory text.
    
The JSON must perfectly match this object schema, without extra keys:
{
  "evaluations": {
    "TEAM_ID": {
      "team_score_out_of_100": number,
      "pundit_review": "vicious but fair short review string",
      "best_value_buy": "name of best purchase",
      "biggest_weakness": "major flaw string",
      "rank": number
    }
  }
}`;

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const parsedData = InputSchema.safeParse(body);

        if (!parsedData.success) {
            return NextResponse.json(
                { error: 'Invalid payload', details: parsedData.error.issues },
                { status: 400 }
            );
        }

        const { teams } = parsedData.data;

        const messages = [
            {
                role: 'system' as const,
                content: systemPrompt,
            },
            {
                role: 'user' as const,
                content: JSON.stringify({ squads: teams }),
            }
        ];

        const chatCompletion = await groq.chat.completions.create({
            model: 'meta-llama/llama-4-scout-17b-16e-instruct',
            messages: messages,
            response_format: { type: 'json_object' },
            temperature: 0.7,
        });

        const responseContent = chatCompletion.choices[0]?.message?.content;

        if (!responseContent) {
            throw new Error('No content received from Groq API');
        }

        const result = JSON.parse(responseContent);

        return NextResponse.json(result, { status: 200 });

    } catch (error: any) {
        console.error('Groq API Error:', error);
        return NextResponse.json(
            { error: 'Failed to evaluate squads', details: error.message },
            { status: 500 }
        );
    }
}
