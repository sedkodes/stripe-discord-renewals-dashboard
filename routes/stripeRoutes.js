const express = require('express');
const router = express.Router();
const License = require('../models/license');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {maxNetworkRetries: 2});
const { removeRole } = require('../discordClient');
const config = require('../config.json');

router.route('/create-checkout-session/:plan').get(async (req, res) => {

    // Create monthly or yearly plan
    const plan = req.params.plan === 'monthly' ? config.stripe.monthlyPlan : config.stripe.yearlyPlan

    // Create Checkout So they can Pay
    const session = await stripe.checkout.sessions.create({
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

// We're redirected here after OAuth2 Flow because we need Email
router.route('/customer-portal').get(async (req,res)=> {
    try {
        const accessToken = await exchangeCodeForAccessToken(req)
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
    console.log('new webhook: ' + req.body.type + ' for: ' + req.body.data.object.billing_details.email);

    switch(req.body.type){
        case 'customer.subscription.deleted': { // Remove from discord
            const subID = req.body.data.object.id;
            const foundLicense = await License.findOne({'paymentInfo.subscriptionID': subID});
            
            if (foundLicense) removeRole(foundLicense.discordID);
            
            break;
        }
        case 'charge.succeeded': {
            
            const email = req.body.data.object.billing_details.email
            const stripe_customer_id = req.body.data.object.customer

            await License.findOneAndUpdate(
                {email},
                {stripe_customer_id},
                {'new':true, 'upsert': true, 'timestamps': true}
                );

            break;
        }
    }

    res.json({received: true});
});

module.exports = router;