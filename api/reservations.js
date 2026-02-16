const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { nom, email, date, heure } = req.body;

    if (!nom || !email || !date) {
        return res.status(400).json({ error: 'Nom, email et date sont requis.' });
    }

    try {
        const existing = await notion.databases.query({
            database_id: databaseId,
            filter: {
                property: 'Date',
                date: { equals: date }
            }
        });

        if (existing.results.length >= 10) {
            return res.status(400).json({ error: 'Ce cours est complet (10/10 places).' });
        }

        await notion.pages.create({
            parent: { database_id: databaseId },
            properties: {
                Nom: {
                    title: [{ text: { content: nom } }]
                },
                Email: {
                    email: email
                },
                Date: {
                    date: { start: date }
                },
                Heure: {
                    rich_text: [{ text: { content: heure } }]
                }
            }
        });

        const placesRestantes = 10 - existing.results.length - 1;
        res.json({ success: true, placesRestantes });
    } catch (err) {
        console.error('Erreur Notion:', err.message);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};
