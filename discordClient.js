const Discord = require('discord.js');
const client = new Discord.Client();
const License = require('./models/license');
const config = require('./config.json');
const serverID = config.discord.serverID; 
const roleID = config.discord.roleID; 
const prefix = config.discord.prefix;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {maxNetworkRetries: 2});
const channels = require('./config.json').discord.channels

let trade_channel, 
    commands_channel,
    community_chats,
    community_alerts,
    starthere_channel,
    emoji_trigger_message

const initClient = () => {
    client.login(process.env.DISCORD_TOKEN);
    client.once('ready', async() => {

        guild = await client.guilds.cache.get(serverID)

        role = guild.roles.cache.find(role => role.name === "Premium");

        // Setup broadcast and listen channels
        trade_channel = client.channels.cache.get(channels.PREMIUM_ALERTS)
        if (trade_channel == undefined) {
            console.error("The trade channel isn't found!")
            return
        }
        commands_channel = client.channels.cache.get(channels.COMMANDS)
        if (commands_channel == undefined) {
            console.error("The input channel isn't found!")
            return
        }
        
        community_chats = client.channels.cache.get(channels.COMMUNITY_CHAT)
        if (community_chats == undefined) {
            console.error("The community chat channel isn't found!")
            return
        }
        community_alerts = client.channels.cache.get(channels.COMMUNITY_ALERTS)
        if (community_alerts == undefined) {
            console.error("The community channel isn't found!")
            return
        }
        starthere_channel = client.channels.cache.get(channels.STARTHERE_CHANNEL)
        if (starthere_channel == undefined) {
            console.error("The community channel isn't found!")
            return
        } 
        emoji_trigger_message = await starthere_channel.messages.fetch(channels.EMOJI_TRIGGER_MESSAGE)
        if (emoji_trigger_message == undefined) {
            console.error("The emoji trigger message isn't found!")
            return
        }

        console.log('Discord client is ready');
    });
}

const removeRole = (discordID) => {
    client.guilds.cache.get(serverID).members.cache.get(discordID).roles.remove(roleID);
}

const addRole = async(discordID) => {
    var guildMember = await guild.members.fetch(discordID)
    guildMember.roles.add(role)
    guildMember.send("Your premium subscription is now activated.")
}

const addToServer = async(discordId, accessToken) => {
    const user = await client.users.fetch(discordId)
    const newMember = await client.guilds.cache.get(serverID).addMember(user, {accessToken: accessToken.access_token})
    
    console.log('new member invited: ', newMember.user.username)
}

messageReactionLogic = async (messageReaction, user) => {
    const paidUser = await License.findOne(
        {'discordID':user.id}
    );

    if (!paidUser || !paidUser.discordID) {
        user.send(
            "Can't find your account.  Please visit \n" +
            "https://discord.com/api/oauth2/authorize?client_id=871758302919397387&redirect_uri=https%3A%2F%2Fef294f67d023.ngrok.io%2Fauth%2Flogin%2Fcallback&response_type=code&scope=email%20guilds.join%20identify\n" +
            " to link.\n" +
            "Please reach out to @Sedky on Discord or support@istocksignals.com for any issues."
        )
        return
    }

    // Open Account Page request
    if (messageReaction.emoji.name === '🗃️') {

        //Create a customer portal and redirect them to it
        const session = await stripe.billingPortal.sessions.create({
            customer: paidUser.stripe_customer_id,
            return_url: 'https://istocksignals.com',
        });

        user.send("please visit: " + session.url)

    // Add role to user request
    } else if (messageReaction.emoji.name === '🔓') {
    
        await addRole(user.id)
        user.send("Subscription started!  Welcome aboard.")
    } else {
        return;
    }
}

// User Emoji Listeners
client.on("messageReactionRemove", async function(messageReaction, user){
    messageReactionLogic(messageReaction, user)
})
client.on("messageReactionAdd", async function(messageReaction, user){
    messageReactionLogic(messageReaction, user)
});

// Admin Commands
client.on('message', async msg => {
    
    // console.log(channels.COMMANDS)
    // console.log(msg.channel.id)

    if (msg.channel.id !== channels.COMMANDS || msg.content.charAt(0) !== prefix) {
        return
    }
        
    const command = msg.content.slice(prefix.length).trim().split(/\n/, 1)[0]
    // console.debug("New command: " + command)
    
    if (command === 'signal') {

        const args = msg.content.slice(prefix.length).trim().split((/\r?\n/));

        if (args.length < 5) {
            msg.channel.send(
                `Usage:
                    !signal
                    Stock Name and Ticker
                    buy price
                    sell price
                    comments - one line only
                    send to free channel (OPTIONAL) - Omit line for "no"
                IE
                    !signal
                    TESLA (TSLA)
                    15.50
                    19.50
                    LOW RISK - move quick on this!
                    true 
            `)
            return;
        }

        console.log("New signal. Attempting to send.")
        const embeddedMessage = { 
            embed: {
                color: 3447003,
                title: "🚨🚨 Signal Alert 🚨🚨" ,
                description: args[1].trim(),
                fields: [{
                    name: "BUY",
                    value: args[2].trim()
                },
                {
                    name: "SELL",
                    value: args[3].trim()
                }]
            }
        }

        if (args[4] !== "-") {
            embeddedMessage.embed.fields.push({
                name: "COMMENTS",
                value: args[4].trim()
            })
        }

        trade_channel.send(embeddedMessage)
        if (args[5]) {
            community_alerts.send(embeddedMessage)
        }

        return;
    } else if (command.startsWith('message')) {

        // Get rid of first line and capture channel id at same time
        const args = msg.content.slice(prefix.length).trim().split((/\r?\n/));
        const channelId = args.shift()?.split(/\s/)[1]
        console.log(args)
        console.log(channelId)
        // If message or channel id are omitted, leave
        if (!args.length || !channelId) {
            msg.channel.send(`
                Usage:
                !message <channel-id>
                <Your message here!>

                Channel IDs:
                ---------
                Community Chat      - ${channels.COMMUNITY_CHAT}
                Community Signals   - ${channels.COMMUNITY_ALERTS}
                Premium Chat        - ${channels.PREMIUM_CHATS}
                Premium Signals     - ${channels.PREMIUM_ALERTS}
                News Trends         - ${channels.NEWS_TRENDS}
                Live Trading        - ${channels.LIVE_TRADING}
            `)
            return;
        }
        
        const channel = client.channels.cache.get(channelId)
        if (channel == undefined) {
            msg.channel.send("Channel '" + channelId+ "' not found.")
            return
        }
        
        // Rejoin all lines into a single string and send to channel.
        channel.send(args.join("\n"))
        return;
    } else {
        msg.channel.send(`
            Available commands are:
                !signal  - Post a new Trade Signal
                !message - send a message as ISS BOT to a channel
        `)
        return;
    }
    
});

module.exports = { addToServer, addRole, initClient, removeRole };
