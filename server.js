var express = require('express')
	, bodyParser = require('body-parser')
	, cookieParser = require('cookie-parser')
	, logger = require('morgan')
	, engines = require('consolidate')
	, swig = require('swig')
	, session = require('express-session')
	, request = require('request')

	, passport = require('passport')
	, NylasStrategy = require('passport-nylas')
	;

var NYLAS_THRD_URL = 'https://api.nylas.com/threads';

require('dotenv').config({
		silent: true
});

var app = express();

var port = process.env.PORT || 4000;

app.use(cookieParser());
app.use(session({
	secret: 'best kept secret',
	resave: true,
	saveUninitialized: true
}));

app.use(bodyParser.urlencoded({
	extended: true
}));
app.use(bodyParser.json());
app.use(logger('dev'));

app.engine('html', engines.swig);
app.set('view engine', 'html')
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'));

app.use(passport.initialize());
app.use(passport.session());

var nylas = new NylasStrategy({
	clientID: process.env.NYLAS_ID,
	clientSecret: process.env.NYLAS_SECRET,
	callbackURL: process.env.NYLAS_CB
}, function(email, accessToken, profile, done) {
		return done(null, {
			email: email,
			accessToken: accessToken
		});
});

passport.use(nylas);

//Passport serializers
// --> configuring Authentication persistance.
passport.serializeUser(function(user, done) {
	done(null, user);
});

passport.deserializeUser(function(obj, done) {
	done(null, obj);
});

app.get('/', function(req, res) {
	console.log('REQ TO /');
	if (req.user) {
		console.log("USER: " + req.user.email);
		console.log(req.session);
		console.log(req.user.accessToken);
		getFirstThread(req.user.accessToken, function(err, thread) {
			console.log(err);
			console.log(thread);
			if (err) {
				res.send('Unable to get First thread. Something went wrong');
				return;
			}

			res.render('index', {
				user: req.user,
				thread: thread
			});
		});
	} else {
		console.log("User: " + req.user);
		res.render('index', { user: req.user });
	}
});

app.get('/auth/nylas', passport.authenticate('nylas', {scope: 'email'}));

app.get('/auth/nylas/cb/', function(req, res, next) {
	passport.authenticate('nylas',
		function(err, user, info) {
			if (err) {
				res.redirect('/login');
			}
			req.login(user, function(err) {
				if (err) {
					console.log('Internal Error, Do try again later');
				}
				res.redirect('/');
			})
		}
	)(req, res, next);
});

var getFirstThread = function(token, cb) {
	if (!token) {
		return cb('Missing credentials.');
	}

	get(token, {offset: 0, limit: 1}, function(err, thread) {
		if (err) {
			return cb(err, null);
		}

		return cb(null, thread[0]);
	});
};

var get = function(token, options, cb) {
	if (!token) {
		return cb("Auth Error, Resource request requires an accessToken")
	};

	var oauth = {
		consumer_key: process.env.NYLAS_ID,
		consumer_secret: process.env.NYLAS_SECRET,
		token: token
	};

	request.get({
		url: NYLAS_THRD_URL,
		oauth: token,
		json: true,
		qs: options
	}, function(err, r, data) {
		if (err) { return cb(err, null); };

		cb(null, data);
	});
};

app.get('/logout', function(req, res) {
	res.redirect('/')
});

app.listen(port);
console.log('Express App running at ' + port);