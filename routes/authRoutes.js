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

        const accessToken = await exchangeCodeForAccessToken(req, '/auth/login/callback')
        const discordResponse = await exchangeAccessTokenForEmail(accessToken)
        console.log("New Oauth Link attempt for: ", discordResponse.data.email)

        if (!discordResponse) {
            return res.error()
        }

        // Save discordID in DB and email in DB
        // If they've paid already before signing into Discord, then we already have a User object
        // with email & stripe ID
        // If they've only gone through Discord, then we may only have a disord ID
        const users = await License.find({
            $or:[ 
                {'email':discordResponse.data.email}, 
                {'discordID':discordResponse.data.id} 
            ]
        })

        // Either way, we must have a user object by now.
        // If not, something has happened.
        if (!users.length) {
            console.log("Error, no user found")
            return res.redirect(discordIds.inviteLink)
        }

        const savedUser = await License.findOneAndUpdate(
            { "_id": users[0]._id },
            {
                'email':discordResponse.data.email,
                'discordID':discordResponse.data.id
            })
        console.log("saved user: ", savedUser)

        // Add premium role if they are paying customer.
        if (savedUser.is_active && savedUser.stripe_customer_id) {
            addRole(discordResponse.data.id, discordIds.premiumRoleId)
        }

        console.log("Link attempt completed for: ", discordResponse.data.email)
        
        // Send them back to Discord
        res.redirect(`https://discord.com/channels/${discordIds.serverID}/${discordIds.channels.STARTHERE_CHANNEL}`);
    } catch (e) {
        console.log(e);
    }
});

// Given an access token from the Discord OAuth Server via token exchange,
// Use it to retrieve ID token for user email address
exchangeAccessTokenForEmail = async(response) => {
    console.debug('exchanging access token for email')
   
    // Get Discord Email & ID from Token
    const discordResponse = await axios.get('http://discordapp.com/api/users/@me', {
        headers: {
            'Authorization': `Bearer ${response.access_token}`
        }
    });

    if (discordResponse.status !== 200){
        return res.status(404).json({msg: "Request Error"});
    }
    return discordResponse;
}

// Given a code from the Discord OAuth Server via callback,
// Exchange it for an access token
exchangeCodeForAccessToken = async(req, originCallBack) => {
    console.debug('exchanging code for access token')

    const redirectUri = process.env.REDIRECT_URI + originCallBack 
    const code = req.query.code;

    let response;
    try {
        response = await axios.post(
            `https://discord.com/api/oauth2/token`,       
            `client_id=${process.env.CLIENT_ID}&client_secret=${process.env.CLIENT_SECRET}&grant_type=authorization_code&code=${code}&redirect_uri=${redirectUri}`
        )
    } catch (err) {
        console.log("err: ", err.response.data)
        return;
    }

    return response.data
}

module.exports = {
    authRoutes: router, 
    exchangeCodeForAccessToken,
    exchangeAccessTokenForEmail,
}; 