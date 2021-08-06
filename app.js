if (process.env.NODE_ENV !== 'production'){
    require('dotenv').config();
}

const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const discordClient = require('./discordClient');

const app = express();

app.use(cookieParser());
app.use(cors({credentials: true, origin: true}));
app.use(express.json());
app.use(morgan('dev'));

console.log(`Attempting to connect to mongo on: ${process.env.MONGO_URI}`)
mongoose.connect(process.env.MONGO_URI, { useUnifiedTopology: true, useNewUrlParser: true, useCreateIndex: true, useFindAndModify: false})
.then(()=>{
    console.log('MongoDB Connected...',);
})
.catch((err)=>{
    console.log('MongoDB Error: ' + err);
});

const { authRoutes } = require('./routes/authRoutes');
const stripeRoutes = require('./routes/stripeRoutes');

app.get('/hello', (req, res) => {
    res.send('Hello World!')
})
app.use('/auth', authRoutes);
app.use('/stripe', stripeRoutes);

discordClient.initClient();

module.exports = app;