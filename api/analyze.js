import OpenAI from "openai";

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

export default async function handler(req, res) {

    try {

        const { data } = req.body;

        const completion =
            await client.responses.create({
                model: "gpt-5",
                input: `
Analyse ce tableau Excel :

${JSON.stringify(data)}

Donne :
- un résumé
- les tendances
- les anomalies éventuelles
- les conclusions
`
            });

        res.status(200).json({
            analysis: completion.output_text
        });

    } catch (error) {

        res.status(500).json({
            error: error.message
        });
    }
}
