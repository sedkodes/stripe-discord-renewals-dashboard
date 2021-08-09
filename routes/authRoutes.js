const express = require('express');
const axios = require('axios');
const { addRole, addToServer } = require('../discordClient');
const router = express.Router();
const inviteLink = require('../config.json').discord.inviteLink;

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

        console.debug("OAuth Link Complete for: ", updatedLicense)

        // Add premium role if they are paying customer.
        if (updatedLicense.is_active && updatedLicense.stripe_customer_id) {
            addRole(updatedLicense.discordID)
        }
        
        // Send them back to Discord
        res.redirect(inviteLink);
    } catch (e) {
        console.log(e);
    }
});

exchangeAccessTokenForEmail = async(response) => {

    // Get Discord Email & ID from Token
    const discordResponse = await axios.get('http://discordapp.com/api/users/@me', {
        headers: {
            'Authorization': `Bearer ${response.access_token}`
        }
    });
    // console.debug('Oauth Token response data: ', discordResponse.data)

    if (discordResponse.status !== 200){
        return res.status(404).json({msg: "Request Error"});
    }
    return discordResponse;
}

exchangeCodeForAccessToken = async(req) => {
    
    // Exchange Code for Token
    const code = req.query.code;
    const response = await axios.post(
      `https://discordapp.com/api/oauth2/token`,       
      `client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&grant_type=authorization_code&code=${code}&redirect_uri=${process.env.REDIRECT_URI}&scope=email%20guilds.join%20identify`
    )
    console.debug('Oauth response data: ', response.data)

    return response.data
}

module.exports = {
    authRoutes: router, 
    exchangeCodeForAccessToken,
    exchangeAccessTokenForEmail,
}; 