const express = require('express');
const axios = require('axios');
const { addRole } = require('../discordClient');
const router = express.Router();
const discordIds = require('../config.json').discord;

// OAuth Callback to save Discord ID & Email Combo
// This is either called after Stripe Payment or Before
// So we don't make any assumptions about adding roles yet.
// Adding the role is done manually by the user.
router.route('/login/callback').get(async (req,res)=>{
    try {
        console.log("New Oauth Link attempt.")

        // Get Access Token and ID Token
        if (req.query.error){
            return res.redirect('http://localhost:3000/');
        }
    
        if (!req.query.code) {
            return res.status(403).json({msg: "Error no code"});
        }

        const accessToken = await exchangeCodeForAccessToken(req)
        const discordResponse = await exchangeAccessTokenForEmail(accessToken)
        console.log("New Oauth Link attempt for: ", discordResponse.data.email)

        if (!discordResponse) {
            return res.error()
        }

        // Save discordID in DB
        // If they've paid already, then we already have a User object
        // With email & stripe ID, which we add Discord ID to
        const updatedLicense = await License.findOneAndUpdate(
            {'email':discordResponse.data.email},
            {'discordID':discordResponse.data.id},
            {'new':true, 'upsert': true, 'timestamps': true}
        );

        // Add premium role if they are paying customer.
        if (updatedLicense.is_active && updatedLicense.stripe_customer_id) {
            addRole(updatedLicense.discordID, config.discord.premiumRoleId)
        }

        console.log("Link attempt completed for: ", discordResponse.data.email)
        
        // Send them back to Discord
        res.redirect(`https://discord.com/channels/${discordIds.serverID}/${discordIds.channels.STARTHERE_CHANNEL}`);
    } catch (e) {
        console.log(e);
    }
});

exchangeAccessTokenForEmail = async(response) => {

    console.debug('exchanging access token for email')
    // Get Discord Email & ID from Token
    const discordResponse = await axios.get('http://discordapp.com/api/users/@me', {
        headers: {
            'Authorization': `Bearer ${response.access_token}`
        }
    });
    console.debug('Oauth Token response data: ', discordResponse.data)

    if (discordResponse.status !== 200){
        return res.status(404).json({msg: "Request Error"});
    }
    return discordResponse;
}

exchangeCodeForAccessToken = async(req) => {
    
    const redirectUri = process.env.REDIRECT_URI
    console.log("exchanging code for acccess token: " + redirectUri)
    // Exchange Code for Token
    const code = req.query.code;
    let response;
    try {
        response = await axios.post(
            `https://discord.com/api/oauth2/token`,       
            `client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&grant_type=authorization_code&code=${code}&redirect_uri=http://localhost:1812/stripe/checkout&scope=email%20guilds.join%20identify`
        )
    } catch (err) {
        console.log("err: ", err.response.data)
        return;
    }
    console.debug('Oauth response data: ', response.data)

    return response.data
}

module.exports = {
    authRoutes: router, 
    exchangeCodeForAccessToken,
    exchangeAccessTokenForEmail,
}; 