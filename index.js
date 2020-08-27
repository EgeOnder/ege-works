const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const yup = require('yup');
const monk = require('monk');
const { nanoid } = require('nanoid');

require('dotenv').config();

const db = monk(process.env.MONGODB_URI);

db.then(() =>{
    console.log('MongoDB connection success!');
}).catch((e)=>{
    console.error('Error occured while connecting to MongoDB: ', e);
});

const urls = db.get('urls');
urls.createIndex({ slug: 1 }, { unique: true });

const app = express()
    .use(helmet())
    .use(morgan('tiny'))
    .use(cors())
    .use(express.json())
    .use(express.static('./public'));

app.get('/:id', async (req, res) => {
    const { id: slug } = req.params;
    try {
        const url = await urls.findOne({ slug });
        if (url) {
            res.redirect(url.url);
        }
        res.redirect(`/?error=${slug} bulunamadı`);
    } catch (error) {
        res.redirect('/?error=Bağlantı bulunamadı');
    }
});

const schema = yup.object().shape({
    slug: yup.string().trim().matches(/[\w\-]/i),
    url: yup.string().trim().url().required(),
});

app.post('/url', async (req, res, next) => {
    let { slug, url } = req.body;
    try {
        await schema.validate({
            slug,
            url,
        });
        if(!slug) {
            slug = nanoid(5);
        } 
        else {
            const existing = await urls.findOne({ slug });
            if(existing) throw new Error('URL kullanılıyor.');
        }
        slug = slug.toLowerCase();
        const newUrl = {
            url,
            slug,
        };
        const created = await urls.insert(newUrl);
        res.json(created);
    } catch (error) {
        next(error);
    }
});

app.use((error, req, res, next) => {
    if(error.status) {
        res.status(error.status);
    } else {
        res.status(500);
    }
    res.json({
        message: error.message,
        stack: process.env.NODE_ENV === 'production' ? 'Production' : error.stack,
    });
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
    console.log(`Listening at PORT ${port}`);
});
