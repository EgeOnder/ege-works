const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const yup = require('yup');
const monk = require('monk');
const { nanoid } = require('nanoid');
const slowDown = require('express-slow-down');
const rateLimit = require('express-rate-limit');
const favicon = require('serve-favicon');
const path = require('path');

require('dotenv').config();

const db = monk(process.env.MONGODB_URI);

db.then(() => {
	console.log('MongoDB connection success!');
}).catch((e) => {
	console.error('Error occured while connecting to MongoDB: ', e);
});

const urls = db.get('urls');
urls.createIndex({ slug: 1 }, { unique: true });

const app = express()
	.use(helmet())
	.use(morgan('common'))
	.use(express.json())
	.use(express.static('./public'))
	.use(favicon(path.join(__dirname, 'public', 'images', 'favicon.ico')));

if (process.env.NODE_ENV === 'production') {
	app.use((req, res, next) => {
		if (req.header('x-forwarded-proto') !== 'https')
			res.redirect(`https://${req.header('host')}${req.url}`);
		else next();
	});
}

app.get('/:id', async (req, res) => {
	const { id: slug } = req.params;
	try {
		const url = await urls.findOne({ slug });
		if (url) {
			res.redirect(url.url);
		}
		return res
			.status(404)
			.sendFile(path.join(__dirname, 'public', '404.html'));
	} catch (error) {
		return res
			.status(404)
			.sendFile(path.join(__dirname, 'public', '404.html'));
	}
});

const schema = yup.object().shape({
	slug: yup
		.string()
		.trim()
		.matches(/[\w\-]/i),
	url: yup.string().trim().url().required(),
});

app.post(
	'/url',
	slowDown({
		windowMs: 30 * 1000,
		delayAfter: 1,
		delayMs: 500,
	}),
	rateLimit({
		windowMs: 30 * 1000,
		max: 1,
	}),
	async (req, res, next) => {
		let { slug, url } = req.body;
		if (url.includes('ege.works')) {
			return res.json({ error: 'You cannot redirect here.' });
		} else if (url.includes('<') || url.includes('>')) {
			return res.json({ error: 'XSS is not allowed.' }).status(403);
		}
		try {
			await schema.validate({
				slug,
				url,
			});
			if (!slug) {
				slug = nanoid(5);
			} else {
				const existing = await urls.findOne({ slug });
				if (existing) throw new Error('URL already in use.');
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
	}
);

app.use((error, req, res, next) => {
	if (error.status) {
		res.status(error.status);
	} else {
		res.status(500);
	}
	res.json({
		message: error.message,
		stack:
			process.env.NODE_ENV === 'production' ? 'Production' : error.stack,
	});
});

app.use((error, res, req, next) => {
	if (error instanceof NotFound) {
		res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
	} else {
		next(error);
	}
});

const port = process.env.PORT || 8000;
app.listen(port, () => {
	console.log(`Listening at PORT ${port}`);
});
