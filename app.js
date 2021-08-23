if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}

const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const discordClient = require('./discordClient');
const bodyParser = require('body-parser')

const app = express();

app.use(cookieParser());
app.use(cors({credentials: true, origin: true}));
app.use(morgan('dev', {
    // Skip hello endpoint checks
    skip: function (req, res) { return req.originalUrl == "/hello" }
}))

console.log(`Attempting to connect to mongo on: ${process.env.MONGO_URI}`)
mongoose.connect(process.env.MONGO_URI, { useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true, useFindAndModify: false})
.then(()=>{
    console.log('MongoDB Connected...',);
})
.catch((err)=>{
    console.log('MongoDB Error: ' + err);
});

app.use(bodyParser.json({verify:function(req,res,buf){req.rawBody=buf}}))

const { authRoutes } = require('./routes/authRoutes');
const stripeRoutes = require('./routes/stripeRoutes');



app.use('/stripe', stripeRoutes, bodyParser.raw({type: "*/*"}));
app.use(express.json());
app.use('/auth', authRoutes);

discordClient.initClient();

app.get('/hello', (req, res) => {
    res.send('Hello World!')
})

module.exports = app;