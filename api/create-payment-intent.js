const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

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
};
