'use strict';

var mongoose = require('mongoose'),
    User = mongoose.model('User'),
    passport = require('passport'),
    SimpleApiKey = mongoose.model('SimpleApiKey'),
    OauthConsumer = mongoose.model('OauthConsumer'),
    OauthClient = mongoose.model('OauthClient'),
    User = mongoose.model('User'),
    ConsumerStrategy = require('passport-http-oauth').ConsumerStrategy,
    TokenStrategy = require('passport-http-oauth').TokenStrategy,
	request = require('superagent');

/**
 * Passport configuration
 */
module.exports = function() {
	passport.serializeUser(function(user, done) {
		done(null, user._id);
	});

	passport.deserializeUser(function(id, done) {
		User.findOne({_id: id}, function(err, user) {
			done(err, user);
		});
	});

	passport.use('consumer', new ConsumerStrategy(
		function(consumerKey, done) {
			OauthConsumer.findOne({ consumer_key: consumerKey }, function(err, client) {
				if (err) { return done(err); }
				if (!client) { return done(null, false); }
				return done(null, client, client.consumer_secret);
			});
		},
		function(requestToken, done) {
			OauthClient.findOne({ request_token: requestToken }, function(err, token) {
				if (err) { return done(err); }

				var info = { verifier: token.verifier,
					clientID: token.consumer,
					userID: token.user,
					approved: token.approved
				};
				done(null, token.request_token_secret, info);
			});
		},
		function(timestamp, nonce, done) {
			done(null, true)
  		}
  	));

  	passport.use('token', new TokenStrategy(
		function(consumerKey, done) {
			OauthConsumer.findOne({ consumer_key: consumerKey }, function(err, client) {
				if (err) { return done(err); }
				if (!client) { return done(null, false); }
				return done(null, client, client.consumer_secret);
			});
		},
		function(accessToken, done) {
			OauthClient.findOne({ access_token: accessToken }, function(err, token) {
				if (err) { return done(err); }
				Users.findOne({ _id: token.userID }, function(err, user) {
					if (err) { return done(err); }
					if (!user) { return done(null, false); }
					// to keep this example simple, restricted scopes are not implemented
					var info = { scope: '*' }
					done(null, user, token.access_token_secret, info);
				});
			});
		},
		function(timestamp, nonce, done) {
			done(null, true)
		}
	));
};