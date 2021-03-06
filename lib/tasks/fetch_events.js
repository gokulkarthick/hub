'use strict';

var config = require('../config/config.js'),
	mongoose = require('mongoose'),
	request = require('superagent'),
	Chapter = mongoose.model('Chapter'),
	Event = mongoose.model('Event'),
	moment = require('moment'),
	async = require('async'),
	request = require('superagent'),
	devsite = require('../clients/devsite');

require('superagent-retry')(request);

module.exports = function(id, params, cb){
		params = params || {};
		var month = params.month || moment().month();

		var lastDayOfMonth = moment().month(month).add('months', 1).date(10).seconds(0).minutes(0).hours(0).unix();
		var firstDayOfMonth = moment().month(month).date(1).subtract('days', 10).seconds(0).minutes(0).hours(0).unix();

		console.log("[task "+ id+"] fetching events (start: "+ firstDayOfMonth + ", end: "+ lastDayOfMonth);
		async.series([
		    function(callback){
		        Chapter.find({}).exec(function(err, chapters) {
					async.each(chapters, function(chapter, chapterCallback) {
						devsite.fetchEventsForChapter(firstDayOfMonth, lastDayOfMonth, chapter._id, function(err, events) {
							if(events) {

								request.get("https://developers.google.com/events/feed/json?group="+chapter._id+"&start="+firstDayOfMonth+"&end="+lastDayOfMonth)
								.retry(2).end(function(err, res) {

									if(events.length != res.body.length) {
										console.log("chapter "+ chapter.name);
										console.log("client says there are: "+ events.length +" events");
										console.log("devsite has "+ res.body.length + " events");
										console.log("EVENT COUNT MISSMATCH!!!");
									}

									async.each(events, function(event, eventsCallback) {
										event.save(function(err) {
											eventsCallback(err);
										});
									}, function(err) {
										chapterCallback(err);
									});
								});
							} else {
								chapterCallback(null);
							}
						});
					}, function(err) {
						console.log("[task "+ id+"] fetched_events");
						callback(err, "done");
					});
				});
		    },
		    function(callback){
				console.log("[task "+ id+"] fetching tags for events");
				var processTag = function(tag, tagCallback, err, events) {
					events = events || [];
					async.each(events, function(ev, evCallback) {
						var patt = /[0-9-]+/g;
						var result = patt.exec(ev.defaultEventUrl);
						Event.findOne({_id: result[0] }).exec(function(err, mev) {
							if(mev) {
								if(mev.tags.indexOf(tag) == -1) {
									mev.tags.push(tag);
									mev.save(function(err) {
										evCallback(err);
									});
								} else {
									evCallback(null);
								}
							} else {
								evCallback(null);
							}
						});
					}, function(err) {
						tagCallback(err);
					});
				};

				devsite.fetchTags(function(err, tagsObject) {
					var tags = [];
					
					for(var key in tagsObject) {
						if(tagsObject[key].id != "gdg")
							tags.push(tagsObject[key].id);
					};

					async.each(tags, function(tag, tagCallback) {
						devsite.fetchTaggedEvents(tag, processTag.bind(this, tag, tagCallback));
					}, function(err) {
						console.log("[task "+ id+"] done fetching tags");
						callback(err, 'two');
					})
				});

		    }
		], function(err) {
			console.log("[task "+ id+"] done");
			if(err) console.log(err);
			// Alldone
			cb(err);
		});
	};