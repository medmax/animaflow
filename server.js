const express = require('express');
const cors = require('cors');
const { Client } = require('@notionhq/client');
const nodemailer = require('nodemailer');
require('dotenv').config();

const Stripe = require('stripe');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Servir les fichiers statiques (index.html, style.css, etc.)
app.use(express.static(path.join(__dirname)));

// Connexion a Notion
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const databaseId = process.env.NOTION_DATABASE_ID;
const indispoDbId = process.env.NOTION_INDISPO_DATABASE_ID;

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD
    }
});

function formatDateFR(dateISO) {
    const jours = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const mois = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
        'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];
    const d = new Date(dateISO + 'T12:00:00');
    return `${jours[d.getDay()]} ${d.getDate()} ${mois[d.getMonth()]} ${d.getFullYear()}`;
}

// POST /api/create-payment-intent — Creer un PaymentIntent Stripe
app.post('/api/create-payment-intent', async (req, res) => {
    const { nom, email, date, heure } = req.body;

    if (!nom || !email || !date) {
        return res.status(400).json({ error: 'Nom, email et date sont requis.' });
    }

    try {
        const paymentIntent = await stripe.paymentIntents.create({
            amount: 1500, // 15€ en centimes
            currency: 'eur',
            payment_method_types: ['card'],
            metadata: {
                nom,
                email,
                date,
                heure: heure || '19h30'
            },
            receipt_email: email
        });

        res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err) {
        console.error('Erreur Stripe:', err.message);
        res.status(500).json({ error: 'Erreur lors de la creation du paiement.' });
    }
});

// POST /api/reservations — Creer une reservation
app.post('/api/reservations', async (req, res) => {
    const { nom, email, telephone, date, heure } = req.body;

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
                },
                'Téléphone': {
                    phone_number: telephone || null
                },
                'Réservé le': {
                    date: { start: new Date().toISOString() }
                }
            }
        });

        const placesRestantes = 10 - existing.results.length - 1;
        const dateLisible = formatDateFR(date);

        // Email de confirmation au client
        await transporter.sendMail({
            from: '"Anima Flow" <animaflow92@gmail.com>',
            to: email,
            subject: `Reservation confirmee — ${dateLisible}`,
            html: `
                <div style="font-family: 'Helvetica Neue', Arial, sans-serif; max-width: 500px; margin: 0 auto; color: #333;">
                    <h2 style="color: #5c6b4f;">Reservation confirmee !</h2>
                    <p>Bonjour ${nom},</p>
                    <p>Votre place est reservee pour le cours Anima Flow :</p>
                    <div style="background: #f5f0eb; padding: 16px; border-radius: 8px; margin: 16px 0;">
                        <p style="margin: 4px 0;"><strong>Date :</strong> ${dateLisible}</p>
                        <p style="margin: 4px 0;"><strong>Heure :</strong> ${heure}</p>
                        <p style="margin: 4px 0;"><strong>Format :</strong> Visioconference — 60 min</p>
                        <p style="margin: 4px 0;"><strong>Tarif :</strong> 15€</p>
                    </div>
                    <p>Le lien de visioconference vous sera envoye par Amina avant le cours.</p>
                    <p>Pour toute annulation (jusqu'a 24h avant), repondez a cet email.</p>
                    <p style="margin-top: 24px;">Namaste 🙏<br><strong>Amina — Anima Flow</strong></p>
                </div>
            `
        });

        // Notification a Amina
        await transporter.sendMail({
            from: '"Anima Flow" <animaflow92@gmail.com>',
            to: 'animaflow92@gmail.com',
            subject: `Nouvelle reservation — ${nom} — ${dateLisible}`,
            html: `
                <div style="font-family: Arial, sans-serif; color: #333;">
                    <h3>Nouvelle reservation !</h3>
                    <p><strong>Nom :</strong> ${nom}</p>
                    <p><strong>Email :</strong> ${email}</p>
                    <p><strong>Date :</strong> ${dateLisible} a ${heure}</p>
                    <p><strong>Places restantes :</strong> ${placesRestantes}/10</p>
                </div>
            `
        });

        res.json({ success: true, placesRestantes });
    } catch (err) {
        console.error('Erreur:', err.message);
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

// GET /api/indisponibilites — Dates ou Amina est indisponible
app.get('/api/indisponibilites', async (req, res) => {
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
});

app.listen(3000, () => {
    console.log('Serveur demarre sur http://localhost:3000');
});
