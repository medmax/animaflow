const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const all = await notion.databases.query({
            database_id: databaseId
        });

        const counts = {};
        for (const page of all.results) {
            const dateVal = page.properties.Date?.date?.start;
            if (dateVal) {
                counts[dateVal] = (counts[dateVal] || 0) + 1;
            }
        }

        res.json(counts);
    } catch (err) {
        console.error('Erreur Notion:', err.message);
        res.status(500).json({ error: 'Erreur serveur.' });
    }
};
