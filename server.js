const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
require('dotenv').config();

const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Servir les fichiers statiques (index.html, style.css, etc.)
app.use(express.static(path.join(__dirname)));

// Connexion a Notion
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;

// POST /api/reservations — Creer une reservation
app.post('/api/reservations', async (req, res) => {
    const { nom, email, date, heure } = req.body;

    if (!nom || !email || !date) {
        return res.status(400).json({ error: 'Nom, email et date sont requis.' });
    }

    try {
        // Verifier combien de reservations existent pour cette date
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

        // Creer la reservation dans Notion
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
});

// GET /api/reservations/count — Nombre de reservations par date
app.get('/api/reservations/count', async (req, res) => {
    try {
        const all = await notion.databases.query({
            database_id: databaseId
        });

        // Compter les reservations par date
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
});

app.listen(3000, () => {
    console.log('Serveur demarre sur http://localhost:3000');
});
