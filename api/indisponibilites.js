const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const indispoDbId = process.env.NOTION_INDISPO_DATABASE_ID;

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const all = await notion.databases.query({
            database_id: indispoDbId
        });

        const dates = [];
        for (const page of all.results) {
            const dateVal = page.properties['Indisponibilité']?.date?.start;
            if (dateVal) {
                dates.push(dateVal);
            }
        }

        res.json(dates);
    } catch (err) {
        console.error('Erreur Notion indispos:', err.message);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};
