const express = require('express');
const router = express.Router();
const License = require('../models/license');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {maxNetworkRetries: 2});
const { removeRole } = require('../discordClient');
const config = require('../config.json');
const endpointSecret = process.env.STRIPE_WEBHOOKSECRET_KEY;

router.route('/create-checkout-session/:plan').get(async (req, res) => {

    // Create monthly or yearly plan
    const plan = req.params.plan === 'monthly' ? config.stripe.monthlyPlan : config.stripe.yearlyPlan

    // Create Checkout So they can Pay
    const session = await stripe.checkout.sessions.create({
    allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: 7,
        },
      payment_method_types: [
        'card'
      ],
      line_items: [
        {
          price: plan,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: config.discord.inviteLink,
      cancel_url: config.discord.inviteLink,
    });

    // Take them to Checkout
    res.redirect(303, session.url)
  });

// Use OAuth2 Flow to get the customer email securely, this is the callback URL
// We need the customer email to find their stripe customer ID create a checkout FOR them
// This is called from the "Account Portal" button on the website
router.route('/customer-portal').get(async (req,res)=> {
    try {
        
        // Get Access Token and ID Token
        if (req.query.error){
            return res.status(403).json({msg: "Error in request."})
        }
    
        if (!req.query.code) {
            return res.status(403).json({msg: "Error no code"});
        }

        console.log('code: ', req.query)
        // return res.status(200).send("hello world")

        const accessToken = await exchangeCodeForAccessToken(req)
        if (!accessToken) {
            return res.status(403).json({msg: "Error getting your info."})
        }

        const discordResponse = await exchangeAccessTokenForEmail(accessToken)

        console.debug('discordResponses: ', discordResponse)
        if (!discordResponse) {
            return res.error()
        }

        // Save license in DB with all attributes
        const paidUser = await License.findOne(
            {'email':discordResponse.data.email}
        );        
        console.debug("paiduser: ", paidUser)

        // If user isn't paid, redirect them to pay
        // They don't have an account and have to purchase first.
        if (!paidUser || !paidUser.stripe_customer_id) {
            res.redirect('https://localhost:1812/create-checkout-session/monthly');
        }

        // Otherwise, create a customer portal and redirect
        const session = await stripe.billingPortal.sessions.create({
            customer: paidUser.stripe_customer_id,
            return_url: 'https://istocksignals.com',
        });

        return res.redirect(session.url)
    } catch (e) {
        console.log(e);
    }
})

router.route('/webhook').post(async (req,res)=> {

    console.log('new webhook: ' + req.body.type + ' for: ' + req.body.data.object.customer);
        
    const sig = req.headers['stripe-signature'];
  
    try {
      stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
    }
    catch (err) {
        console.log(err.message)
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch(req.body.type){
        // Remove role from discord
        case 'invoice.payment_failed':
        case 'customer.subscription.deleted': { 
            const stripe_customer_id = req.body.data.object.customer;

            // We already have customer email and Stripe customer ID saved from thei purchase
            // Can simply use the Stripe customer ID for lookup
            const foundUser = await License.findOneAndUpdate({stripe_customer_id}, {is_active: false});
            
            if (foundUser) removeRole(foundUser.discordID);
            
            break;
        }
        // Save permissions to account
        case 'checkout.session.completed': {

            // Lookup the user via EMAIL if they're already registered
            // And linked with their Discord profile
            // Otherwise, create a new entry and save the stripe customer ID
            const email = req.body.data.object.customer_details.email
            const stripe_customer_id = req.body.data.object.customer

            await License.findOneAndUpdate(
                {email},
                {stripe_customer_id, is_active: true},
                {'new':true, 'upsert': true, 'timestamps': true}
                );

            break;
        }
    }

    res.json({received: true});
});

module.exports = router;